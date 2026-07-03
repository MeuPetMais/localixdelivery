import type { AIUsageEntry, AISkillKey, AIProviderKey } from "./types";

const log: AIUsageEntry[] = [];
let seq = 0;

export const AIUsageService = {
  record(input: Omit<AIUsageEntry, "id" | "at">): AIUsageEntry {
    const entry: AIUsageEntry = { ...input, id: `aiu_${++seq}`, at: new Date().toISOString() };
    log.push(Object.freeze({ ...entry }) as AIUsageEntry);
    return entry;
  },
  list(restaurantId: string): AIUsageEntry[] {
    return log.filter((e) => e.restaurant_id === restaurantId);
  },
  summary(restaurantId: string): {
    requests: number; tokens_in: number; tokens_out: number; cost_estimate: number;
    avg_latency_ms: number; by_skill: Record<string, number>;
    by_provider: Record<string, number>;
  } {
    const rows = AIUsageService.list(restaurantId);
    const by_skill: Record<string, number> = {};
    const by_provider: Record<string, number> = {};
    let latSum = 0;
    for (const r of rows) {
      by_skill[r.skill] = (by_skill[r.skill] ?? 0) + 1;
      by_provider[r.provider] = (by_provider[r.provider] ?? 0) + 1;
      latSum += r.latency_ms;
    }
    return {
      requests: rows.length,
      tokens_in: rows.reduce((s, r) => s + r.tokens_in, 0),
      tokens_out: rows.reduce((s, r) => s + r.tokens_out, 0),
      cost_estimate: Math.round(rows.reduce((s, r) => s + r.cost_estimate, 0) * 10000) / 10000,
      avg_latency_ms: rows.length ? Math.round(latSum / rows.length) : 0,
      by_skill, by_provider,
    };
  },
  monthlyCount(restaurantId: string, kind: "requests" | "tokens"): number {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    const s = start.getTime();
    const rows = log.filter((e) => e.restaurant_id === restaurantId && new Date(e.at).getTime() >= s);
    if (kind === "requests") return rows.length;
    return rows.reduce((sum, r) => sum + r.tokens_in + r.tokens_out, 0);
  },
  countBy(restaurantId: string, provider: AIProviderKey, skill?: AISkillKey): number {
    return log.filter((e) =>
      e.restaurant_id === restaurantId &&
      e.provider === provider &&
      (!skill || e.skill === skill),
    ).length;
  },
  clear() { log.length = 0; seq = 0; },
} as const;
