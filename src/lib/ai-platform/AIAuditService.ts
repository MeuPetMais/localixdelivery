import type { AIAuditEntry, AISkillKey } from "./types";

const log: AIAuditEntry[] = [];
let seq = 0;

function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return `h_${h.toString(16)}`;
}

export const AIAuditService = {
  hash,
  record(input: {
    restaurant_id: string; actor_id?: string; skill: AISkillKey;
    prompt_id?: string; prompt: string; response: string; metadata?: Record<string, unknown>;
  }): AIAuditEntry {
    const entry: AIAuditEntry = {
      id: `aia_${++seq}`,
      restaurant_id: input.restaurant_id,
      actor_id: input.actor_id,
      skill: input.skill,
      prompt_id: input.prompt_id,
      prompt_hash: hash(input.prompt),
      response_hash: hash(input.response),
      metadata: input.metadata ?? {},
      at: new Date().toISOString(),
    };
    log.push(Object.freeze({ ...entry }) as AIAuditEntry);
    return entry;
  },
  list(restaurantId?: string): AIAuditEntry[] {
    return restaurantId ? log.filter((e) => e.restaurant_id === restaurantId) : [...log];
  },
  clear() { log.length = 0; seq = 0; },
} as const;
