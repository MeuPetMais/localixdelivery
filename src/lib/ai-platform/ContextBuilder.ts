import type { AISkillKey, AISkillContext } from "./types";

const SENSITIVE_KEYS = /(password|token|secret|api[_-]?key|cpf|cnpj|card|cvv|ssn)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[max-depth]";
  if (value == null) return value;
  if (typeof value === "string") return value.length > 4000 ? value.slice(0, 4000) + "…" : value;
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.test(k)) { out[k] = "[redacted]"; continue; }
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Pure context builder. Never touches the DB — receives domain snapshots
 * from callers (which come from public Services of each domain).
 *
 * Snapshot keys expected (all optional):
 *  - customer: from CustomerIntelligenceService.snapshot
 *  - product:  from Product Intelligence services
 *  - finance:  from Finance/Analytics services
 *  - inventory
 *  - delivery
 *  - analytics
 *  - marketing
 */
export const ContextBuilder = {
  build(input: {
    restaurant_id: string; skill: AISkillKey; question?: string;
    domain_snapshot: Record<string, unknown>; locale?: string; actor_id?: string;
    metadata?: Record<string, unknown>;
  }): AISkillContext {
    return {
      restaurant_id: input.restaurant_id,
      actor_id: input.actor_id,
      skill: input.skill,
      question: input.question,
      domain_snapshot: sanitize(input.domain_snapshot) as Record<string, unknown>,
      locale: input.locale ?? "pt-BR",
      metadata: input.metadata ?? {},
    };
  },

  serialize(ctx: AISkillContext): string {
    return JSON.stringify(ctx.domain_snapshot, null, 2);
  },

  sanitize,
} as const;
