import type { EvaluationContext, FeatureFlag } from "./types";
import { isWithinRollout } from "./rollout";

export interface FeatureFlagEvaluation {
  key: string;
  enabled: boolean;
  reason:
    | "killed"
    | "archived"
    | "disabled"
    | "expired"
    | "environment_mismatch"
    | "region_mismatch"
    | "channel_mismatch"
    | "plan_mismatch"
    | "tenant_mismatch"
    | "rollout_excluded"
    | "matched_default"
    | "matched_targeting";
  matched_scope?: "global" | "plan" | "tenant" | "environment";
}

export const FeatureFlagEngine = {
  evaluate(flag: FeatureFlag, ctx: EvaluationContext = {}): FeatureFlagEvaluation {
    if (flag.killed) return { key: flag.key, enabled: false, reason: "killed" };
    if (flag.status === "archived") return { key: flag.key, enabled: false, reason: "archived" };
    if (flag.status === "disabled") return { key: flag.key, enabled: false, reason: "disabled" };

    const t = flag.targeting ?? {};
    if (t.expires_at && new Date(t.expires_at).getTime() < Date.now()) {
      return { key: flag.key, enabled: false, reason: "expired" };
    }
    if (t.environments?.length && ctx.environment && !t.environments.includes(ctx.environment)) {
      return { key: flag.key, enabled: false, reason: "environment_mismatch" };
    }
    if (t.regions?.length && ctx.region && !t.regions.includes(ctx.region)) {
      return { key: flag.key, enabled: false, reason: "region_mismatch" };
    }
    if (t.channels?.length && ctx.channel && !t.channels.includes(ctx.channel)) {
      return { key: flag.key, enabled: false, reason: "channel_mismatch" };
    }

    let matched_scope: FeatureFlagEvaluation["matched_scope"];
    let matched = false;

    if (t.tenants?.length) {
      if (ctx.tenantId && t.tenants.includes(ctx.tenantId)) { matched = true; matched_scope = "tenant"; }
      else return { key: flag.key, enabled: false, reason: "tenant_mismatch" };
    }
    if (!matched && t.plans?.length) {
      if (ctx.plan && t.plans.includes(ctx.plan)) { matched = true; matched_scope = "plan"; }
      else return { key: flag.key, enabled: false, reason: "plan_mismatch" };
    }
    if (!matched && t.environments?.length) matched_scope = "environment";
    if (!matched) matched_scope = matched_scope ?? "global";

    if (typeof t.rollout_percent === "number") {
      const key = ctx.bucketKey ?? ctx.tenantId ?? flag.key;
      if (!isWithinRollout(`${flag.key}:${key}`, t.rollout_percent)) {
        return { key: flag.key, enabled: false, reason: "rollout_excluded", matched_scope };
      }
    }

    if (matched) return { key: flag.key, enabled: true, reason: "matched_targeting", matched_scope };
    return { key: flag.key, enabled: flag.default_value, reason: "matched_default", matched_scope };
  },

  isEnabled(flag: FeatureFlag, ctx?: EvaluationContext): boolean {
    return this.evaluate(flag, ctx).enabled;
  },
};
