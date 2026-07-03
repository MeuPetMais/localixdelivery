import type { TenantConfigurationService } from "@/lib/tenant/TenantConfigurationService";
import type { ConfigGroup, GroupPayload, TenantConfiguration } from "@/lib/tenant/types";
import { EmployeeService } from "./EmployeeService";
import { FeatureFlagService } from "./FeatureFlagService";
import { AdminAuditService } from "./AdminAuditService";
import { PermissionRegistry } from "./PermissionRegistry";
import { RestaurantSettingsEventBus, restaurantSettingsEventBus } from "./RestaurantSettingsEventBus";
import type { EmployeeRole, Permission } from "./types";

export interface RestaurantSettingsDeps {
  tenant: TenantConfigurationService;
  employees: EmployeeService;
  audit: AdminAuditService;
  features?: FeatureFlagService;
  bus?: RestaurantSettingsEventBus;
}

/**
 * Facade for the Restaurant Settings & Administration domain.
 * All configuration reads/writes MUST go through TenantConfigurationService.
 */
export class RestaurantSettingsService {
  readonly employees: EmployeeService;
  readonly audit: AdminAuditService;
  readonly features: FeatureFlagService;
  private readonly tenant: TenantConfigurationService;
  private readonly bus: RestaurantSettingsEventBus;

  constructor(deps: RestaurantSettingsDeps) {
    this.tenant = deps.tenant;
    this.employees = deps.employees;
    this.audit = deps.audit;
    this.bus = deps.bus ?? restaurantSettingsEventBus;
    this.features = deps.features ?? new FeatureFlagService(deps.tenant, this.bus);
  }

  getAll(restaurantId: string): Promise<TenantConfiguration> {
    return this.tenant.get(restaurantId);
  }

  getGroup<G extends ConfigGroup>(restaurantId: string, group: G) {
    return this.tenant.getGroup(restaurantId, group);
  }

  async updateGroup<G extends ConfigGroup>(
    restaurantId: string, group: G, value: GroupPayload<G>, changedBy?: string,
  ) {
    const result = await this.tenant.update(restaurantId, group, value, changedBy);
    if (result.ok) {
      this.bus.publish({
        type: "SettingsUpdated", restaurant_id: restaurantId,
        group, version: result.version, changed_by: changedBy,
      });
    }
    return result;
  }

  async rollback<G extends ConfigGroup>(
    restaurantId: string, group: G, targetVersion: number, changedBy?: string,
  ) {
    const result = await this.tenant.rollback(restaurantId, group, targetVersion, changedBy);
    this.bus.publish({
      type: "SettingsRolledBack", restaurant_id: restaurantId,
      group, version: result.version, changed_by: changedBy,
    });
    return result;
  }

  can(role: EmployeeRole, permission: Permission) {
    return PermissionRegistry.can(role, permission);
  }
}
