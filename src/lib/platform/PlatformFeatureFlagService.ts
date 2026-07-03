// Feature flags globais da plataforma (não confundir com feature flags por tenant,
// que vivem em RestaurantSettings/FeatureFlagService).
//
// Persistência recomendada: `platform_settings.feature_flags` (jsonb).

export interface PlatformFeatureFlagState {
  flags: Record<string, boolean>;
}

export const DEFAULT_PLATFORM_FLAGS: Record<string, boolean> = {
  "platform.new_dashboard": true,
  "platform.ai_insights": false,
  "platform.multi_currency": false,
  "platform.moderation_center": false,
  "platform.incident_center": false,
  "platform.support_center_v2": true,
};

export const PlatformFeatureFlagService = {
  isEnabled(state: PlatformFeatureFlagState | undefined, key: string): boolean {
    if (state && key in state.flags) return state.flags[key];
    return DEFAULT_PLATFORM_FLAGS[key] ?? false;
  },
  setFlag(state: PlatformFeatureFlagState | undefined, key: string, enabled: boolean): PlatformFeatureFlagState {
    return { flags: { ...(state?.flags ?? {}), [key]: enabled } };
  },
  list(state: PlatformFeatureFlagState | undefined): Record<string, boolean> {
    return { ...DEFAULT_PLATFORM_FLAGS, ...(state?.flags ?? {}) };
  },
};
