import { describe, expect, it } from "vitest";
import {
  PlatformPermissionRegistry,
  PlanCatalogService,
  PlatformAuditService,
  InMemoryPlatformAuditRepository,
  PlatformEventBus,
  TenantAdministrationService,
  SubscriptionMonitorService,
  PlatformDashboardService,
  PlatformFeatureFlagService,
  SupportCenterService,
  ModerationCenterService,
  IncidentCenterService,
  GlobalNotificationCenterService,
} from "./index";

describe("PlatformPermissionRegistry", () => {
  it("super_admin has all writes", () => {
    expect(PlatformPermissionRegistry.can("super_admin", "platform.tenants.write")).toBe(true);
    expect(PlatformPermissionRegistry.can("super_admin", "platform.plans.write")).toBe(true);
  });
  it("read_only cannot write", () => {
    expect(PlatformPermissionRegistry.can("read_only", "platform.dashboard.read")).toBe(true);
    expect(PlatformPermissionRegistry.can("read_only", "platform.tenants.write")).toBe(false);
  });
  it("finance_admin scoped to finance", () => {
    expect(PlatformPermissionRegistry.can("finance_admin", "platform.finance.write")).toBe(true);
    expect(PlatformPermissionRegistry.can("finance_admin", "platform.support.write")).toBe(false);
  });
  it("assertCan throws when forbidden", () => {
    expect(() => PlatformPermissionRegistry.assertCan("read_only", "platform.tenants.write")).toThrow();
  });
});

describe("PlanCatalogService", () => {
  it("returns known plans", () => {
    expect(PlanCatalogService.list()).toHaveLength(4);
    expect(PlanCatalogService.get("pro").commission_rate).toBe(0.03);
  });
  it("detects upgrades", () => {
    expect(PlanCatalogService.isUpgrade("free", "pro")).toBe(true);
    expect(PlanCatalogService.isUpgrade("pro", "starter")).toBe(false);
  });
  it("respects limits", () => {
    expect(PlanCatalogService.isWithinLimit("free", "max_products", 20)).toBe(true);
    expect(PlanCatalogService.isWithinLimit("free", "max_products", 999)).toBe(false);
    expect(PlanCatalogService.isWithinLimit("enterprise", "max_products", 1_000_000)).toBe(true);
  });
});

describe("PlatformAuditService", () => {
  it("records and lists entries", async () => {
    const svc = new PlatformAuditService(new InMemoryPlatformAuditRepository());
    await svc.record({
      actor_id: "u1", actor_role: "super_admin",
      action: "tenant.suspended", target_type: "restaurant", target_id: "r1",
    });
    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(list[0].action).toBe("tenant.suspended");
  });
  it("diffs objects", () => {
    const svc = new PlatformAuditService();
    const diff = svc.diff({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 });
    expect(diff).toEqual({ b: { from: 2, to: 3 }, c: { from: undefined, to: 4 } });
  });
});

describe("PlatformEventBus", () => {
  it("dispatches events to subscribers", async () => {
    PlatformEventBus.clear();
    const seen: string[] = [];
    PlatformEventBus.subscribe((e) => { seen.push(e.type); });
    await PlatformEventBus.publish({
      type: "PlatformTenantStatusChanged",
      tenantId: "r1", from: "active", to: "suspended", actorId: "u1",
    });
    expect(seen).toEqual(["PlatformTenantStatusChanged"]);
    PlatformEventBus.clear();
  });
});

describe("TenantAdministrationService", () => {
  const tenants = [
    { id: "r1", name: "Alpha", plan: "pro" as const, active: true, is_open: true, created_at: new Date().toISOString() },
    { id: "r2", name: "Beta",  plan: "free" as const, active: false, is_open: false, created_at: new Date().toISOString() },
  ];
  const orders = [
    { restaurant_id: "r1", total: 100, created_at: new Date().toISOString() },
    { restaurant_id: "r1", total: 50,  created_at: new Date().toISOString() },
    { restaurant_id: "r2", total: 30,  created_at: new Date().toISOString() },
  ];
  it("computes tenant summary with commission", () => {
    const dir = TenantAdministrationService.buildDirectory(tenants, orders);
    expect(dir[0].id).toBe("r1");
    expect(dir[0].gmv).toBe(150);
    expect(dir[0].commission).toBeCloseTo(150 * 0.03 + 2 * 0.59, 4);
  });
  it("filters by status/plan/search", () => {
    const dir = TenantAdministrationService.buildDirectory(tenants, orders);
    expect(TenantAdministrationService.filter(dir, { status: "suspended" })).toHaveLength(1);
    expect(TenantAdministrationService.filter(dir, { plan: "pro" })[0].id).toBe("r1");
    expect(TenantAdministrationService.filter(dir, { search: "alph" })[0].id).toBe("r1");
  });
});

describe("SubscriptionMonitorService", () => {
  it("projects active status", () => {
    const s = SubscriptionMonitorService.project({ tenantId: "r1", plan: "pro" });
    expect(s.status).toBe("active");
  });
  it("detects past due", () => {
    const s = SubscriptionMonitorService.project({ tenantId: "r1", plan: "pro", failures: 2 });
    expect(s.status).toBe("past_due");
    expect(SubscriptionMonitorService.isOverdue(s)).toBe(true);
  });
  it("detects trialing", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const s = SubscriptionMonitorService.project({ tenantId: "r1", plan: "starter", trialEndsAt: future });
    expect(s.status).toBe("trialing");
  });
});

describe("PlatformDashboardService", () => {
  it("aggregates tenants, orders and subs", () => {
    const now = new Date();
    const snap = PlatformDashboardService.build({
      tenants: [
        { id: "r1", name: "A", plan: "pro", active: true, is_open: true, created_at: now.toISOString() },
        { id: "r2", name: "B", plan: "free", active: false, is_open: false, created_at: now.toISOString() },
      ],
      orders: [
        { restaurant_id: "r1", total: 200, created_at: now.toISOString() },
        { restaurant_id: "r2", total: 40,  created_at: now.toISOString() },
      ],
      subscriptions: [
        { plan: "pro", monthly_price: 199 },
        { plan: "free", monthly_price: 0 },
        { plan: "starter", overdue: true, monthly_price: 79 },
      ],
      criticalErrors: 0,
    });
    expect(snap.restaurants.total).toBe(2);
    expect(snap.restaurants.suspended).toBe(1);
    expect(snap.finance.gmv).toBe(240);
    expect(snap.finance.mrr).toBe(199 + 79);
    expect(snap.subscriptions.overdue).toBe(1);
    expect(snap.ops.status).toBe("ok");
  });
});

describe("PlatformFeatureFlagService", () => {
  it("returns default when not set", () => {
    expect(PlatformFeatureFlagService.isEnabled(undefined, "platform.new_dashboard")).toBe(true);
    expect(PlatformFeatureFlagService.isEnabled(undefined, "platform.ai_insights")).toBe(false);
  });
  it("overrides via state", () => {
    const s = PlatformFeatureFlagService.setFlag(undefined, "platform.ai_insights", true);
    expect(PlatformFeatureFlagService.isEnabled(s, "platform.ai_insights")).toBe(true);
  });
});

describe("Support / Moderation / Incident / Notifications", () => {
  it("sorts and detects SLA breach", () => {
    const oldTs = new Date(Date.now() - 3 * 3600_000).toISOString();
    const tickets = [
      { id: "a", ticket_number: 1, subject: "x", status: "open" as const, priority: "low" as const, assignee_id: null, restaurant_id: "r1", created_at: oldTs, last_message_at: oldTs },
      { id: "b", ticket_number: 2, subject: "y", status: "open" as const, priority: "urgent" as const, assignee_id: null, restaurant_id: "r1", created_at: oldTs, last_message_at: oldTs },
    ];
    expect(SupportCenterService.sort(tickets)[0].id).toBe("b");
    expect(SupportCenterService.slaBreached(tickets[1])).toBe(true);
  });
  it("validates moderation events", () => {
    expect(() => ModerationCenterService.validate({ target_type: "review", target_id: "", action: "hidden", actor_id: "u1" })).toThrow();
  });
  it("computes incident duration", () => {
    const now = new Date();
    const inc = { title: "x", severity: "high" as const, status: "open" as const, affected_area: "orders", opened_at: new Date(now.getTime() - 60_000).toISOString() };
    expect(IncidentCenterService.isOpen(inc)).toBe(true);
    expect(IncidentCenterService.duration(inc, now)).toBeGreaterThanOrEqual(60_000);
  });
  it("validates global notifications", () => {
    expect(() => GlobalNotificationCenterService.validate({ audience: "specific_tenants", title: "t", body: "b", severity: "info" })).toThrow();
    expect(() => GlobalNotificationCenterService.validate({ audience: "all_tenants", title: "t", body: "b", severity: "info" })).not.toThrow();
  });
});
