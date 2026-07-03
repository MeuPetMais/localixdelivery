// Templates de configuração — snapshots pré-definidos que aplicam
// múltiplas flags/config em conjunto (ex.: "beta_pack", "safe_mode").

import type { EvaluationContext, FeatureFlag, RemoteConfigEntry } from "./types";

export interface ConfigurationTemplate {
  key: string;
  name: string;
  description?: string;
  flags: Array<Partial<FeatureFlag> & { key: string }>;
  configs: Array<Partial<RemoteConfigEntry> & { key: string; value: unknown }>;
}

export const ConfigurationTemplateService = {
  applies(template: ConfigurationTemplate, ctx: EvaluationContext): boolean {
    return Boolean(template.key && template.name && ctx);
  },
  merge(base: FeatureFlag, patch: Partial<FeatureFlag>): FeatureFlag {
    return { ...base, ...patch, targeting: { ...base.targeting, ...(patch.targeting ?? {}) } };
  },
};
