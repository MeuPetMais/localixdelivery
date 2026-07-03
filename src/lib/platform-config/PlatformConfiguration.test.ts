import { describe, expect, it } from "vitest";
import {
  FeatureFlagEngine,
  PlatformConfigurationService,
  isWithinRollout,
  bucketOf,
  KILL_SWITCH_DOMAINS,
  ConfigurationTemplateService,
} from "./index";
import type { FeatureFlag } from "./types";

function baseFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    key: "f", name: "f", description: "", status: "active", scope: "global",
    default_value: false, targeting: {}, version: 1,
    created_at: new Date().toISOString(), created_by: "u1", killed: false,
    ...overrides,
  };
}

describe("rollout bucketing", () => {
  it("bucketOf is deterministic and in [0,100)", () => {
    const a = bucketOf("abc"); const b = bucketOf("abc");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });
  it("isWithinRollout: 0 excludes, 100 includes", () => {
    expect(isWithinRollout("k", 0)).toBe(false);
    expect(isWithinRollout("k", 100)).toBe(true);
  });
  it("isWithinRollout distributes roughly to target percent", () => {
    let hits = 0;
    for (let i = 0; i < 1000; i++) if (isWithinRollout(`tenant-${i}`, 25)) hits++;
    expect(hits).toBeGreaterThan(150);
    expect(hits).toBeLessThan(350);
  });
});

describe("FeatureFlagEngine", () => {
  it("killed always false", () => {
    expect(FeatureFlagEngine.isEnabled(baseFlag({ killed: true, default_value: true }))).toBe(false);
  });
  it("archived/disabled false", () => {
    expect(FeatureFlagEngine.isEnabled(baseFlag({ status: "archived", default_value: true }))).toBe(false);
    expect(FeatureFlagEngine.isEnabled(baseFlag({ status: "disabled", default_value: true }))).toBe(false);
  });
  it("expired temporary flag disables", () => {
    const f = baseFlag({ default_value: true, targeting: { expires_at: new Date(Date.now() - 1000).toISOString() } });
    expect(FeatureFlagEngine.evaluate(f).reason).toBe("expired");
  });
  it("plan targeting matches only listed plans", () => {
    const f = baseFlag({ default_value: false, targeting: { plans: ["pro"] } });
    expect(FeatureFlagEngine.isEnabled(f, { plan: "pro" })).toBe(true);
    expect(FeatureFlagEngine.isEnabled(f, { plan: "free" })).toBe(false);
  });
  it("tenant targeting has precedence", () => {
    const f = baseFlag({ targeting: { tenants: ["r1"] } });
    expect(FeatureFlagEngine.isEnabled(f, { tenantId: "r1" })).toBe(true);
    expect(FeatureFlagEngine.isEnabled(f, { tenantId: "r2" })).toBe(false);
  });
  it("environment/region/channel mismatch disables", () => {
    const f = baseFlag({ default_value: true, targeting: { environments: ["prod"], regions: ["br-south"], channels: ["web"] } });
    expect(FeatureFlagEngine.isEnabled(f, { environment: "prod", region: "br-south", channel: "web" })).toBe(true);
    expect(FeatureFlagEngine.isEnabled(f, { environment: "dev", region: "br-south", channel: "web" })).toBe(false);
  });
  it("rollout gate excludes/includes deterministically", () => {
    const f = baseFlag({ default_value: true, targeting: { rollout_percent: 0 } });
    expect(FeatureFlagEngine.isEnabled(f, { tenantId: "any" })).toBe(false);
    const g = baseFlag({ default_value: true, targeting: { rollout_percent: 100 } });
    expect(FeatureFlagEngine.isEnabled(g, { tenantId: "any" })).toBe(true);
  });
});

describe("PlatformConfigurationService — flags", () => {
  it("create/update/versioning/rollback with audit", async () => {
    const svc = new PlatformConfigurationService();
    const created = await svc.createFlag({ key: "checkout.v2", name: "Checkout V2", description: "", scope: "global", default_value: false, actorId: "admin" });
    expect(created.version).toBe(1);

    const updated = await svc.updateFlag({ key: "checkout.v2", default_value: true, actorId: "admin", reason: "beta" });
    expect(updated.version).toBe(2);
    expect(svc.isFeatureEnabled("checkout.v2", { tenantId: "r1" })).toBe(true);

    const rolled = await svc.rollbackFlag("checkout.v2", 1, "admin", "regression");
    expect(rolled.version).toBe(3);
    expect(rolled.default_value).toBe(false);

    const history = svc.flags.history("checkout.v2");
    expect(history.map((h) => h.version)).toEqual([1, 2, 3]);

    const audit = await svc.audit.history("checkout.v2");
    expect(audit.some((a) => a.action === "flag.rolled_back")).toBe(true);
  });

  it("kill switch on a flag forces disabled", async () => {
    const svc = new PlatformConfigurationService();
    await svc.createFlag({ key: "ai.suggest", name: "AI", description: "", scope: "global", default_value: true, actorId: "admin" });
    expect(svc.isFeatureEnabled("ai.suggest")).toBe(true);
    await svc.killFlag("ai.suggest", "admin", "incident");
    expect(svc.isFeatureEnabled("ai.suggest")).toBe(false);
    await svc.reviveFlag("ai.suggest", "admin");
    expect(svc.isFeatureEnabled("ai.suggest")).toBe(true);
  });

  it("setRolloutPercent gates evaluation", async () => {
    const svc = new PlatformConfigurationService();
    await svc.createFlag({ key: "wave", name: "Wave", description: "", scope: "global", default_value: true, actorId: "admin" });
    await svc.setRolloutPercent("wave", 0, "admin");
    expect(svc.isFeatureEnabled("wave", { tenantId: "any" })).toBe(false);
    await svc.setRolloutPercent("wave", 100, "admin");
    // clear cache changed automatically
    expect(svc.isFeatureEnabled("wave", { tenantId: "any" })).toBe(true);
  });
});

describe("PlatformConfigurationService — remote config", () => {
  it("versioned set + rollback", async () => {
    const svc = new PlatformConfigurationService();
    const v1 = await svc.setConfig<number>({ key: "checkout.timeout_ms", value: 3000, scope: "global", actorId: "admin" });
    expect(v1.version).toBe(1);
    const v2 = await svc.setConfig<number>({ key: "checkout.timeout_ms", value: 5000, scope: "global", actorId: "admin" });
    expect(v2.version).toBe(2);
    expect(svc.remoteConfig.resolve("checkout.timeout_ms")).toBe(5000);
    const rb = await svc.rollbackConfig("checkout.timeout_ms", 1, "admin");
    expect(rb.value).toBe(3000);
    expect(rb.version).toBe(3);
  });

  it("resolve respects targeting", async () => {
    const svc = new PlatformConfigurationService();
    await svc.setConfig<string>({ key: "msg.banner", value: "hi pro", scope: "plan", targeting: { plans: ["pro"] }, actorId: "admin" });
    expect(svc.remoteConfig.resolve<string>("msg.banner", { plan: "pro" }, "default")).toBe("hi pro");
    expect(svc.remoteConfig.resolve<string>("msg.banner", { plan: "free" }, "default")).toBe("default");
  });
});

describe("Plans & kill switches", () => {
  it("plan feature override", async () => {
    const svc = new PlatformConfigurationService();
    expect(svc.planHasFeature("free", "loyalty.basic")).toBe(false);
    await svc.updatePlanFeatures({ plan: "free", features: ["orders.basic", "loyalty.basic"], actorId: "admin" });
    expect(svc.planHasFeature("free", "loyalty.basic")).toBe(true);
  });

  it("kill switch toggles and blocks", async () => {
    const svc = new PlatformConfigurationService();
    for (const d of KILL_SWITCH_DOMAINS) expect(svc.isKillSwitchActive(d)).toBe(false);
    await svc.activateKillSwitch("payments", "admin", "provider outage");
    expect(svc.isKillSwitchActive("payments")).toBe(true);
    expect(() => svc.killSwitch.assertOperational("payments")).toThrow();
    await svc.deactivateKillSwitch("payments", "admin");
    expect(svc.isKillSwitchActive("payments")).toBe(false);
  });
});

describe("ConfigurationTemplateService", () => {
  it("merges patches preserving targeting", () => {
    const base = baseFlag({ targeting: { plans: ["pro"], rollout_percent: 10 } });
    const merged = ConfigurationTemplateService.merge(base, { default_value: true, targeting: { rollout_percent: 50 } });
    expect(merged.default_value).toBe(true);
    expect(merged.targeting.plans).toEqual(["pro"]);
    expect(merged.targeting.rollout_percent).toBe(50);
  });
});

describe("Audit history is append-only", () => {
  it("does not allow mutation of stored entries", async () => {
    const svc = new PlatformConfigurationService();
    await svc.createFlag({ key: "x", name: "x", description: "", scope: "global", actorId: "admin" });
    const [entry] = await svc.audit.list();
    expect(() => { (entry as any).action = "hacked"; }).toThrow();
  });
});
