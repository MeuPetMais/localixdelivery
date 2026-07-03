import { afterEach, describe, expect, it } from "vitest";
import {
  AIOrchestrationPlatform, AIOrchestrator, PromptManager, AISettingsService,
  AIUsageService, AIAuditService, AIEventBus, AIProviderRegistry,
  ContextBuilder, AISafetyLayer, AIForecastService, AIRecommendationsService,
} from "./index";

const R = "rest_ai";

afterEach(() => {
  PromptManager.clear();
  AISettingsService.clear();
  AIUsageService.clear();
  AIAuditService.clear();
  AIEventBus.clear();
  AIProviderRegistry.reset();
  AIOrchestrator.clearCache();
});

describe("PromptManager", () => {
  it("has builtins per skill and renders variables", () => {
    const tpl = PromptManager.active("financial_assistant");
    expect(tpl).not.toBeNull();
    const rendered = PromptManager.render(tpl!, { context: "kpis...", question: "?" });
    expect(rendered.user).toContain("kpis...");
  });

  it("register bumps version and deactivates previous", () => {
    const v2 = PromptManager.register({
      skill: "product_assistant", system: "S2", user: "U2 {{context}} {{question}}",
      variables: ["context", "question"],
    });
    expect(v2.version).toBe(2);
    expect(PromptManager.active("product_assistant")!.id).toBe(v2.id);
  });

  it("throws on missing variables", () => {
    const tpl = PromptManager.active("product_assistant")!;
    expect(() => PromptManager.render(tpl, {})).toThrow(/Missing template variables/);
  });
});

describe("ContextBuilder", () => {
  it("redacts sensitive keys and clamps depth", () => {
    const ctx = ContextBuilder.build({
      restaurant_id: R, skill: "restaurant_assistant",
      domain_snapshot: { customer: { name: "x", password: "abc", token: "t" } },
    });
    const snap = ctx.domain_snapshot.customer as Record<string, unknown>;
    expect(snap.password).toBe("[redacted]");
    expect(snap.token).toBe("[redacted]");
    expect(snap.name).toBe("x");
  });
});

describe("AISafetyLayer", () => {
  it("denies when disabled", () => {
    AISettingsService.update(R, { enabled: false });
    const r = AISafetyLayer.check({ restaurant_id: R, skill: "restaurant_assistant" });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("disabled");
  });

  it("denies when skill disabled", () => {
    AISettingsService.update(R, { enabled_skills: [] });
    expect(AISafetyLayer.check({ restaurant_id: R, skill: "restaurant_assistant" }).reason).toBe("skill_disabled");
  });

  it("denies when permission missing", () => {
    const r = AISafetyLayer.check({ restaurant_id: R, skill: "financial_assistant", permissions: ["other"] });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("missing_permission");
  });

  it("allows when everything ok", () => {
    expect(AISafetyLayer.check({
      restaurant_id: R, skill: "financial_assistant",
      permissions: ["ai.assistant.finance"],
    }).allowed).toBe(true);
  });
});

describe("AIOrchestrator", () => {
  it("runs a skill and records usage + audit + events", async () => {
    const events: string[] = [];
    AIEventBus.subscribe((e) => { events.push(e.type); });
    const res = await AIOrchestrator.run({
      restaurant_id: R, skill: "restaurant_assistant",
      question: "Como estão as vendas?", domain_snapshot: { restaurant_name: "Bistro" },
    });
    expect(res.provider).toBe("mock");
    expect(res.answer).toContain("[mock:");
    expect(AIUsageService.list(R)).toHaveLength(1);
    expect(AIAuditService.list(R)).toHaveLength(1);
    expect(events).toEqual(expect.arrayContaining(["AISkillInvoked", "AISkillCompleted"]));
  });

  it("blocks when skill disabled", async () => {
    AISettingsService.update(R, { enabled_skills: ["financial_assistant"] });
    await expect(AIOrchestrator.run({
      restaurant_id: R, skill: "restaurant_assistant", domain_snapshot: {},
    })).rejects.toThrow(/AI denied/);
  });

  it("enforces request limits and emits AILimitExceeded", async () => {
    AISettingsService.update(R, { monthly_request_limit: 1 });
    await AIOrchestrator.run({ restaurant_id: R, skill: "restaurant_assistant", domain_snapshot: {} });
    const events: string[] = [];
    AIEventBus.subscribe((e) => { events.push(e.type); });
    await expect(AIOrchestrator.run({
      restaurant_id: R, skill: "restaurant_assistant", domain_snapshot: {},
    })).rejects.toThrow();
    expect(events).toContain("AILimitExceeded");
  });

  it("caches identical prompts within TTL", async () => {
    const a = await AIOrchestrator.run({ restaurant_id: R, skill: "product_assistant", domain_snapshot: { x: 1 }, question: "?" });
    const b = await AIOrchestrator.run({ restaurant_id: R, skill: "product_assistant", domain_snapshot: { x: 1 }, question: "?" });
    expect(a.answer).toBe(b.answer);
  });
});

describe("AIUsageService.summary", () => {
  it("aggregates by skill and provider", async () => {
    await AIOrchestrator.run({ restaurant_id: R, skill: "restaurant_assistant", domain_snapshot: {} });
    await AIOrchestrator.run({ restaurant_id: R, skill: "financial_assistant", domain_snapshot: {}, permissions: ["ai.assistant.finance"] });
    const s = AIUsageService.summary(R);
    expect(s.requests).toBe(2);
    expect(s.by_provider.mock).toBe(2);
    expect(Object.keys(s.by_skill)).toHaveLength(2);
  });
});

describe("AIForecastService", () => {
  it("returns points and detects trend", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ date: `2025-01-${i + 1}`, value: i + 1 }));
    const f = AIForecastService.forecast({ restaurant_id: R, kind: "sales", horizon_days: 5, history });
    expect(f.points).toHaveLength(5);
    expect(f.trend).toBe("up");
    expect(f.confidence).toBeGreaterThan(0.9);
  });

  it("degrades gracefully with too little data", () => {
    const f = AIForecastService.forecast({ restaurant_id: R, kind: "sales", horizon_days: 3, history: [] });
    expect(f.trend).toBe("flat");
    expect(f.points).toHaveLength(3);
  });
});

describe("AIRecommendationsService", () => {
  it("aggregates and orders by source priority", () => {
    const recs = AIRecommendationsService.aggregate({
      from_analytics: ["a1"],
      from_finance: ["f1"],
      from_customer_intelligence: ["c1"],
    });
    expect(recs.map((r) => r.source)).toEqual(["from_finance", "from_customer_intelligence", "from_analytics"]);
  });
});

describe("AIOrchestrationPlatform facade", () => {
  it("exposes composed modules", () => {
    expect(AIOrchestrationPlatform.orchestrator).toBe(AIOrchestrator);
    expect(AIOrchestrationPlatform.forecast).toBe(AIForecastService);
  });
});
