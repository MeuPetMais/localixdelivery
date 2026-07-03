import type { AISkillKey } from "./types";
import { AISettingsService } from "./AISettingsService";
import { AIUsageService } from "./AIUsageService";
import { AISkillRegistry } from "./AISkillRegistry";

export type SafetyDenyReason = "disabled" | "skill_disabled" | "missing_permission" | "requests_limit" | "tokens_limit";

export interface SafetyCheckInput {
  restaurant_id: string;
  skill: AISkillKey;
  permissions?: string[];
}

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: SafetyDenyReason;
}

export const AISafetyLayer = {
  check(input: SafetyCheckInput): SafetyCheckResult {
    const settings = AISettingsService.get(input.restaurant_id);
    if (!settings.enabled) return { allowed: false, reason: "disabled" };
    if (!settings.enabled_skills.includes(input.skill)) return { allowed: false, reason: "skill_disabled" };
    const def = AISkillRegistry.get(input.skill);
    if (input.permissions && !input.permissions.includes(def.requires_permission)) {
      return { allowed: false, reason: "missing_permission" };
    }
    if (AIUsageService.monthlyCount(input.restaurant_id, "requests") >= settings.monthly_request_limit) {
      return { allowed: false, reason: "requests_limit" };
    }
    if (AIUsageService.monthlyCount(input.restaurant_id, "tokens") >= settings.monthly_token_limit) {
      return { allowed: false, reason: "tokens_limit" };
    }
    return { allowed: true };
  },
} as const;
