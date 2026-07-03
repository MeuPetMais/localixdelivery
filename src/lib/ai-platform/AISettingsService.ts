import type { AISettings, AISkillKey } from "./types";

const store = new Map<string, AISettings>();

function defaults(restaurantId: string): AISettings {
  return {
    restaurant_id: restaurantId,
    enabled: true,
    default_model: "google/gemini-3-flash-preview",
    default_provider: "mock",
    language: "pt-BR",
    enabled_skills: [
      "restaurant_assistant", "financial_assistant", "product_assistant",
      "inventory_assistant", "marketing_assistant", "operational_assistant",
    ],
    monthly_request_limit: 5_000,
    monthly_token_limit: 2_000_000,
  };
}

export const AISettingsService = {
  get(restaurantId: string): AISettings {
    return store.get(restaurantId) ?? defaults(restaurantId);
  },
  update(restaurantId: string, patch: Partial<AISettings>): AISettings {
    const next = { ...AISettingsService.get(restaurantId), ...patch, restaurant_id: restaurantId };
    store.set(restaurantId, next);
    return next;
  },
  isSkillEnabled(restaurantId: string, skill: AISkillKey): boolean {
    const s = AISettingsService.get(restaurantId);
    return s.enabled && s.enabled_skills.includes(skill);
  },
  clear() { store.clear(); },
} as const;
