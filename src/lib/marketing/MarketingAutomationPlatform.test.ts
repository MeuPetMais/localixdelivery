import { afterEach, describe, expect, it } from "vitest";
import {
  MarketingAutomationPlatform,
  CampaignService,
  AudienceBuilder,
  AutomationEngine,
  CampaignSchedulerService,
  CampaignTemplateService,
  CampaignAnalyticsService,
  JourneyBuilder,
  ABTestingEngine,
  MarketingAudit,
  MarketingEventBus,
  type AudienceCandidate,
} from "./index";

const R = "rest_1";

afterEach(() => {
  CampaignService.clear();
  AutomationEngine.clear();
  CampaignSchedulerService.clear();
  CampaignTemplateService.clear();
  JourneyBuilder.clear();
  MarketingAudit.clear();
  MarketingEventBus.clear();
});

const candidates: AudienceCandidate[] = [
  { customer_id: "c1", segment: "VIP", marketing_consent: true, total_orders: 10, total_spent: 900,
    channels: { EMAIL: true, PUSH: true, SMS: false, WHATSAPP: true, IN_APP: true } },
  { customer_id: "c2", segment: "INACTIVE", marketing_consent: true, total_orders: 2, total_spent: 60,
    channels: { EMAIL: true, PUSH: false, SMS: false, WHATSAPP: false, IN_APP: true } },
  { customer_id: "c3", segment: "VIP", marketing_consent: false, total_orders: 8, total_spent: 400,
    channels: { EMAIL: true, PUSH: true, SMS: false, WHATSAPP: true, IN_APP: true } },
  { customer_id: "c4", segment: "ACTIVE", marketing_consent: true, total_orders: 5, total_spent: 200,
    channels: { EMAIL: false, PUSH: false, SMS: false, WHATSAPP: false, IN_APP: false } },
];

describe("AudienceBuilder", () => {
  it("filters by segment and consent", () => {
    const r = AudienceBuilder.resolve(
      { id: "x", audience: { segment: "VIP" }, channels: ["EMAIL"] },
      candidates,
    );
    expect(r.customer_ids).toEqual(["c1"]);
    expect(r.reasons.segment).toBe(2);
    expect(r.reasons.consent).toBe(1);
  });

  it("respects explicit customer_ids", () => {
    const r = AudienceBuilder.resolve(
      { id: "x", audience: { customer_ids: ["c1", "c2"] }, channels: ["EMAIL"] },
      candidates,
    );
    expect(r.size).toBe(2);
  });

  it("filters by min_orders/min_spent and channel eligibility", () => {
    const r = AudienceBuilder.resolve(
      { id: "x", audience: { min_orders: 5, min_spent: 100 }, channels: ["EMAIL"] },
      candidates,
    );
    expect(r.customer_ids).toEqual(["c1"]);
    expect(r.reasons.channel).toBe(1);
  });
});

describe("CampaignService", () => {
  it("creates, launches and completes with lifecycle events", async () => {
    const events: string[] = [];
    MarketingEventBus.subscribe((e) => { events.push(e.type); });
    const c = await CampaignService.create({
      restaurant_id: R, name: "VIP push", type: "VIP", channels: ["PUSH", "EMAIL"],
      audience: { segment: "VIP" },
    });
    expect(c.status).toBe("draft");
    const dispatch = await CampaignService.launch(c.id, candidates);
    expect(dispatch.audience_size).toBe(1);
    expect(CampaignService.get(c.id)!.status).toBe("running");
    await CampaignService.complete(c.id);
    expect(events).toEqual(expect.arrayContaining(["CampaignCreated", "CampaignLaunched", "CampaignCompleted"]));
  });

  it("schedules and cancels", async () => {
    const c = await CampaignService.create({
      restaurant_id: R, name: "Later", type: "COUPON", channels: ["PUSH"],
      audience: {}, scheduled_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(c.status).toBe("scheduled");
    expect(CampaignSchedulerService.list(R)).toHaveLength(1);
    await CampaignService.cancel(c.id);
    expect(CampaignSchedulerService.list(R)).toHaveLength(0);
  });

  it("rejects invalid transitions", async () => {
    const c = await CampaignService.create({
      restaurant_id: R, name: "x", type: "COUPON", channels: ["PUSH"], audience: {},
    });
    await CampaignService.launch(c.id, candidates);
    await CampaignService.complete(c.id);
    await expect(CampaignService.pause(c.id)).rejects.toThrow(/Invalid campaign transition/);
  });
});

describe("A/B Testing", () => {
  it("distributes deterministically across variants", () => {
    const config = { variants: [{ key: "A", weight: 1 }, { key: "B", weight: 1 }] };
    const groups = ABTestingEngine.distribute(config, Array.from({ length: 200 }, (_, i) => `u${i}`));
    expect(groups.A.length + groups.B.length).toBe(200);
    expect(groups.A.length).toBeGreaterThan(50);
    expect(groups.B.length).toBeGreaterThan(50);
    // deterministic
    const again = ABTestingEngine.assign(config, "u42");
    expect(ABTestingEngine.assign(config, "u42").key).toBe(again.key);
  });
});

describe("Scheduler", () => {
  it("returns only due jobs", async () => {
    await CampaignService.create({
      restaurant_id: R, name: "past", type: "COUPON", channels: ["PUSH"], audience: {},
      scheduled_at: new Date(Date.now() - 5000).toISOString(),
    });
    await CampaignService.create({
      restaurant_id: R, name: "future", type: "COUPON", channels: ["PUSH"], audience: {},
      scheduled_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(CampaignSchedulerService.due(new Date().toISOString())).toHaveLength(1);
  });
});

describe("Templates", () => {
  it("filters builtins by type and channel", () => {
    expect(CampaignTemplateService.listByType("VIP").length).toBeGreaterThan(0);
    expect(CampaignTemplateService.listByChannel("PUSH").length).toBeGreaterThan(0);
    expect(CampaignTemplateService.get("tpl_vip")).not.toBeNull();
  });
});

describe("AutomationEngine", () => {
  it("fires only active automations for trigger", async () => {
    const a1 = AutomationEngine.create({ restaurant_id: R, name: "Welcome", trigger: "WELCOME", channels: ["PUSH"] });
    const a2 = AutomationEngine.create({ restaurant_id: R, name: "Repurchase", trigger: "REPURCHASE", channels: ["PUSH"] });
    AutomationEngine.toggle(a2.id, false);
    const fired = await AutomationEngine.fire(R, "WELCOME", "c1");
    expect(fired.map((x) => x.id)).toEqual([a1.id]);
  });
});

describe("JourneyBuilder", () => {
  it("validates step references", () => {
    const j = JourneyBuilder.create({
      restaurant_id: R, name: "onb", active: true, entry: "s1",
      steps: { s1: { id: "s1", next: ["s2"] }, s2: { id: "s2" } },
    });
    expect(JourneyBuilder.validate(j)).toEqual([]);
    const bad = JourneyBuilder.create({
      restaurant_id: R, name: "bad", active: true, entry: "s1",
      steps: { s1: { id: "s1", next: ["s9"] } },
    });
    expect(JourneyBuilder.validate(bad)).not.toEqual([]);
  });
});

describe("CampaignAnalytics", () => {
  it("computes rates and ROI", () => {
    const m = CampaignAnalyticsService.compute({
      campaign_id: "c1", audience_size: 100, delivered: 100, opened: 40, clicked: 20, converted: 10,
      revenue: 500, cost: 100,
    });
    expect(m.open_rate).toBe(40);
    expect(m.click_rate).toBe(20);
    expect(m.conversion_rate).toBe(10);
    expect(m.roi).toBe(4);
  });

  it("aggregates multiple campaigns", () => {
    const a = CampaignAnalyticsService.compute({ campaign_id: "a", audience_size: 100, delivered: 100, opened: 20, revenue: 100, cost: 50 });
    const b = CampaignAnalyticsService.compute({ campaign_id: "b", audience_size: 200, delivered: 200, opened: 60, revenue: 300, cost: 100 });
    const agg = CampaignAnalyticsService.aggregate([a, b]);
    expect(agg.campaigns).toBe(2);
    expect(agg.revenue).toBe(400);
    expect(agg.open_rate).toBeCloseTo((80 / 300) * 100, 1);
  });
});

describe("MarketingAudit", () => {
  it("records immutable entries scoped by tenant", async () => {
    await CampaignService.create({
      restaurant_id: R, name: "a", type: "COUPON", channels: ["PUSH"], audience: {},
    });
    const rows = MarketingAudit.list(R);
    expect(rows.length).toBeGreaterThan(0);
    expect(() => { (rows[0] as any).action = "hacked"; }).toThrow();
  });
});

describe("MarketingAutomationPlatform facade", () => {
  it("exposes composed services", () => {
    expect(MarketingAutomationPlatform.campaigns).toBe(CampaignService);
    expect(MarketingAutomationPlatform.automations).toBe(AutomationEngine);
    expect(MarketingAutomationPlatform.analytics).toBe(CampaignAnalyticsService);
  });
});
