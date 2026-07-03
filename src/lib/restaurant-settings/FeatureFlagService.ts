import type { TenantConfigurationService } from "@/lib/tenant/TenantConfigurationService";
import type { FeatureFlags } from "@/lib/tenant/types";
import { RestaurantSettingsEventBus } from "./RestaurantSettingsEventBus";

export class FeatureFlagService {
  constructor(
    private readonly tenant: TenantConfigurationService,
    private readonly bus?: RestaurantSettingsEventBus,
  ) {}

  async list(restaurantId: string): Promise<FeatureFlags> {
    return this.tenant.getGroup(restaurantId, "features");
  }

  async isEnabled(restaurantId: string, flag: keyof FeatureFlags): Promise<boolean> {
    const flags = await this.list(restaurantId);
    return Boolean(flags[flag]);
  }

  async set(restaurantId: string, flag: keyof FeatureFlags, enabled: boolean, changedBy?: string) {
    const current = await this.list(restaurantId);
    const next: FeatureFlags = { ...current, [flag]: enabled };
    const result = await this.tenant.update(restaurantId, "features", next, changedBy);
    if (result.ok) {
      this.bus?.publish({ type: "FeatureFlagChanged", restaurant_id: restaurantId, flag: String(flag), enabled });
    }
    return result;
  }
}
