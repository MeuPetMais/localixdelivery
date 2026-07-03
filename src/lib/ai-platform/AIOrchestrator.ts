import type {
  AICompletionResponse, AIProviderKey, AISkillContext, AISkillKey, AISkillResult,
} from "./types";
import { AISettingsService } from "./AISettingsService";
import { AISafetyLayer } from "./AISafetyLayer";
import { AISkillRegistry } from "./AISkillRegistry";
import { PromptManager } from "./PromptManager";
import { ContextBuilder } from "./ContextBuilder";
import { AIProviderRegistry } from "./AIProviderRegistry";
import { AIUsageService } from "./AIUsageService";
import { AIAuditService } from "./AIAuditService";
import { AIEventBus } from "./AIEventBus";

interface RunInput {
  restaurant_id: string;
  actor_id?: string;
  skill: AISkillKey;
  question?: string;
  domain_snapshot: Record<string, unknown>;
  permissions?: string[];
  provider?: AIProviderKey;
  model?: string;
  locale?: string;
  metadata?: Record<string, unknown>;
}

const cache = new Map<string, { at: number; response: AICompletionResponse }>();
const CACHE_TTL = 10_000;

function cacheKey(promptId: string, system: string, user: string, model: string): string {
  return `${promptId}|${model}|${AIAuditService.hash(system + "|" + user)}`;
}

export const AIOrchestrator = {
  async run(input: RunInput): Promise<AISkillResult> {
    const now = new Date().toISOString();
    await AIEventBus.publish({ type: "AISkillInvoked", restaurantId: input.restaurant_id, skill: input.skill, at: now });

    const safety = AISafetyLayer.check({
      restaurant_id: input.restaurant_id, skill: input.skill, permissions: input.permissions,
    });
    if (!safety.allowed) {
      await AIEventBus.publish({
        type: "AISkillDenied", restaurantId: input.restaurant_id, skill: input.skill,
        reason: safety.reason ?? "unknown", at: now,
      });
      if (safety.reason === "requests_limit" || safety.reason === "tokens_limit") {
        await AIEventBus.publish({
          type: "AILimitExceeded", restaurantId: input.restaurant_id,
          kind: safety.reason === "tokens_limit" ? "tokens" : "requests", at: now,
        });
      }
      throw new Error(`AI denied: ${safety.reason}`);
    }

    AISkillRegistry.get(input.skill); // validates
    const settings = AISettingsService.get(input.restaurant_id);
    const provider = AIProviderRegistry.get(input.provider ?? settings.default_provider);
    const model = input.model ?? settings.default_model;

    const template = PromptManager.active(input.skill);
    if (!template) throw new Error(`No active prompt for skill ${input.skill}`);

    const ctx = ContextBuilder.build({
      restaurant_id: input.restaurant_id, actor_id: input.actor_id, skill: input.skill,
      question: input.question, domain_snapshot: input.domain_snapshot,
      locale: input.locale ?? settings.language, metadata: input.metadata,
    });

    const vars: Record<string, unknown> = {
      restaurant_name: (input.domain_snapshot.restaurant_name as string) ?? input.restaurant_id,
      locale: ctx.locale,
      context: ContextBuilder.serialize(ctx),
      question: input.question ?? "Gerar insights",
    };
    const missing = template.variables.filter((v) => !(v in vars));
    for (const m of missing) vars[m] = "";

    const rendered = PromptManager.render(template, vars);

    const key = cacheKey(template.id, rendered.system, rendered.user, model);
    const cached = cache.get(key);
    let response: AICompletionResponse;
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      response = cached.response;
    } else {
      response = await provider.complete({
        model,
        messages: [
          { role: "system", content: rendered.system },
          { role: "user", content: rendered.user },
        ],
      });
      cache.set(key, { at: Date.now(), response });
    }

    AIUsageService.record({
      restaurant_id: input.restaurant_id, skill: input.skill,
      provider: response.provider, model: response.model,
      tokens_in: response.tokens_in, tokens_out: response.tokens_out,
      cost_estimate: response.cost_estimate, latency_ms: response.latency_ms,
    });
    AIAuditService.record({
      restaurant_id: input.restaurant_id, actor_id: input.actor_id, skill: input.skill,
      prompt_id: template.id, prompt: rendered.system + "\n" + rendered.user,
      response: response.content, metadata: { model, provider: response.provider },
    });

    await AIEventBus.publish({
      type: "AISkillCompleted", restaurantId: input.restaurant_id, skill: input.skill,
      latency_ms: response.latency_ms, at: new Date().toISOString(),
    });

    return {
      skill: input.skill,
      answer: response.content,
      recommendations: [],
      used_domains: AISkillRegistry.get(input.skill).domains,
      provider: response.provider,
      model: response.model,
      latency_ms: response.latency_ms,
      tokens_in: response.tokens_in,
      tokens_out: response.tokens_out,
      cost_estimate: response.cost_estimate,
    };
  },

  clearCache() { cache.clear(); },
} as const;
