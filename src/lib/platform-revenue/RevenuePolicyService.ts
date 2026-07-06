// RevenuePolicyService — valida vigência da política de receita.
import type { RevenuePolicy } from "./types";

export const RevenuePolicyService = {
  isActive(policy: RevenuePolicy, now: Date = new Date()): boolean {
    if (!policy.active) return false;
    const t = now.getTime();
    if (policy.effective_from && t < Date.parse(policy.effective_from)) return false;
    if (policy.effective_until && t > Date.parse(policy.effective_until)) return false;
    return true;
  },
};
