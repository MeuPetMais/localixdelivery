import { describe, expect, it, beforeEach } from "vitest";
import { PermissionRegistry } from "./PermissionRegistry";
import { RestaurantSettingsEventBus } from "./RestaurantSettingsEventBus";
import { EmployeeService } from "./EmployeeService";
import { AdminAuditService } from "./AdminAuditService";
import { FeatureFlagService } from "./FeatureFlagService";
import { RestaurantSettingsService } from "./RestaurantSettingsService";
import { TenantConfigurationService, type TenantConfigRepository } from "@/lib/tenant/TenantConfigurationService";
import { TenantConfigurationCache } from "@/lib/tenant/TenantConfigurationCache";
import { DEFAULT_CONFIG, type ConfigGroup, type GroupPayload, type TenantConfiguration } from "@/lib/tenant/types";
import type { AdminAuditEntry, AdminAuditRepository, Employee, EmployeeRepository } from "./types";

const RID = "rest-1";

class MemoryTenantRepo implements TenantConfigRepository {
  data: Partial<TenantConfiguration> = { configuration_version: 1, status: "ACTIVE" };
  async loadAll() { return this.data; }
  async saveGroup<G extends ConfigGroup>(_r: string, group: G, value: GroupPayload<G>) {
    (this.data as any)[group] = value;
  }
  async bumpVersion() {
    this.data.configuration_version = (this.data.configuration_version ?? 0) + 1;
    return this.data.configuration_version!;
  }
}

class MemoryEmployeeRepo implements EmployeeRepository {
  rows: Employee[] = [];
  async list(rid: string) { return this.rows.filter((r) => r.restaurant_id === rid); }
  async upsert(e: Omit<Employee, "id" | "created_at"> & { id?: string }) {
    const id = e.id ?? `emp-${this.rows.length + 1}`;
    const saved: Employee = { ...e, id, created_at: new Date().toISOString() };
    const idx = this.rows.findIndex((r) => r.id === id);
    if (idx >= 0) this.rows[idx] = saved; else this.rows.push(saved);
    return saved;
  }
  async remove(_rid: string, id: string) { this.rows = this.rows.filter((r) => r.id !== id); }
}

class MemoryAuditRepo implements AdminAuditRepository {
  rows: AdminAuditEntry[] = [];
  async list(rid: string, limit = 50) {
    return this.rows.filter((r) => r.restaurant_id === rid).slice(-limit);
  }
  async insert(e: AdminAuditEntry) { this.rows.push({ ...e, id: `a-${this.rows.length + 1}` }); }
}

function build() {
  const bus = new RestaurantSettingsEventBus();
  const tenant = new TenantConfigurationService({
    repo: new MemoryTenantRepo(), cache: new TenantConfigurationCache(1000),
  });
  const employees = new EmployeeService(new MemoryEmployeeRepo(), bus);
  const audit = new AdminAuditService(new MemoryAuditRepo());
  const features = new FeatureFlagService(tenant, bus);
  const service = new RestaurantSettingsService({ tenant, employees, audit, features, bus });
  return { bus, tenant, employees, audit, features, service };
}

describe("PermissionRegistry", () => {
  it("grants full permissions to admin", () => {
    expect(PermissionRegistry.can("admin", "settings.write")).toBe(true);
    expect(PermissionRegistry.can("admin", "features.write")).toBe(true);
  });
  it("restricts viewer to read-only", () => {
    expect(PermissionRegistry.can("viewer", "settings.read")).toBe(true);
    expect(PermissionRegistry.can("viewer", "settings.write")).toBe(false);
  });
  it("scopes finance to finance permissions", () => {
    expect(PermissionRegistry.can("finance", "finance.write")).toBe(true);
    expect(PermissionRegistry.can("finance", "menu.write")).toBe(false);
  });
  it("scopes attendant to orders only", () => {
    expect(PermissionRegistry.can("attendant", "orders.write")).toBe(true);
    expect(PermissionRegistry.can("attendant", "settings.read")).toBe(false);
  });
});

describe("RestaurantSettingsService", () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => { ctx = build(); });

  it("reads defaults through the tenant service", async () => {
    const cfg = await ctx.service.getAll(RID);
    expect(cfg.payment.default_gateway).toBe(DEFAULT_CONFIG.payment.default_gateway);
  });

  it("updates a group and emits SettingsUpdated", async () => {
    const events: string[] = [];
    ctx.bus.subscribe((e) => events.push(e.type));
    const next = { ...DEFAULT_CONFIG.payment, minimum_order: 25 };
    const r = await ctx.service.updateGroup(RID, "payment", next, "user-1");
    expect(r.ok).toBe(true);
    expect(events).toContain("SettingsUpdated");
  });

  it("rejects invalid payment configuration", async () => {
    const bad = { ...DEFAULT_CONFIG.payment, minimum_order: -1 };
    const r = await ctx.service.updateGroup(RID, "payment", bad as any);
    expect(r.ok).toBe(false);
  });

  it("toggles feature flags and emits FeatureFlagChanged", async () => {
    const events: any[] = [];
    ctx.bus.subscribe((e) => events.push(e));
    const r = await ctx.features.set(RID, "loyalty_enabled", true);
    expect(r.ok).toBe(true);
    expect(events.some((e) => e.type === "FeatureFlagChanged" && e.enabled)).toBe(true);
    expect(await ctx.features.isEnabled(RID, "loyalty_enabled")).toBe(true);
  });
});

describe("EmployeeService", () => {
  it("invites, updates and removes employees emitting events", async () => {
    const ctx = build();
    const events: any[] = [];
    ctx.bus.subscribe((e) => events.push(e));
    const emp = await ctx.employees.invite({
      restaurant_id: RID, user_id: "u-1", name: "Alice", email: "a@x.com", role: "manager",
    });
    expect(emp.id).toBeDefined();
    await ctx.employees.updateRole(emp.id, RID, "finance", emp);
    await ctx.employees.remove(RID, emp.id);
    expect(events.map((e) => e.type)).toEqual(["EmployeeCreated","EmployeeUpdated","EmployeeRemoved"]);
    expect(await ctx.employees.list(RID)).toEqual([]);
  });
});

describe("AdminAuditService", () => {
  it("diffs changed fields only", async () => {
    const ctx = build();
    const entries = await ctx.audit.diff(RID, "payment",
      { minimum_order: 10, delivery_fee: 5 },
      { minimum_order: 20, delivery_fee: 5 },
      "user-1",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].field).toBe("minimum_order");
    expect(entries[0].new_value).toBe(20);
  });
});
