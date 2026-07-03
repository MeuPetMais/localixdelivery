import {
  DEFAULT_CONFIG, type ConfigGroup, type GroupPayload, type TenantConfiguration,
} from "./types";
import { TenantConfigurationCache, tenantConfigCache } from "./TenantConfigurationCache";
import { validateGroup, type ValidationResult } from "./TenantConfigurationValidator";
import { TenantConfigurationVersioning, type VersioningRepository } from "./TenantConfigurationVersioning";
import { TenantAudit, type AuditRepository } from "./TenantAudit";

export interface TenantConfigRepository {
  loadAll(restaurantId: string): Promise<Partial<TenantConfiguration>>;
  saveGroup<G extends ConfigGroup>(restaurantId: string, group: G, value: GroupPayload<G>): Promise<void>;
  bumpVersion(restaurantId: string): Promise<number>;
}

export interface TenantServiceDeps {
  repo: TenantConfigRepository;
  versioning?: TenantConfigurationVersioning;
  audit?: TenantAudit;
  cache?: TenantConfigurationCache;
}

export class TenantConfigurationService {
  private readonly repo: TenantConfigRepository;
  private readonly cache: TenantConfigurationCache;
  private readonly versioning?: TenantConfigurationVersioning;
  private readonly audit?: TenantAudit;

  constructor(deps: TenantServiceDeps) {
    this.repo = deps.repo;
    this.cache = deps.cache ?? tenantConfigCache;
    this.versioning = deps.versioning;
    this.audit = deps.audit;
  }

  async get(restaurantId: string): Promise<TenantConfiguration> {
    const cached = this.cache.get(restaurantId);
    if (cached) return cached;
    const loaded = await this.repo.loadAll(restaurantId);
    const merged: TenantConfiguration = {
      restaurant_id: restaurantId,
      configuration_version: loaded.configuration_version ?? 1,
      status: loaded.status ?? "ACTIVE",
      payment: { ...DEFAULT_CONFIG.payment, ...(loaded.payment ?? {}) },
      delivery: { ...DEFAULT_CONFIG.delivery, ...(loaded.delivery ?? {}) },
      business: { ...DEFAULT_CONFIG.business, ...(loaded.business ?? {}) },
      branding: { ...DEFAULT_CONFIG.branding, ...(loaded.branding ?? {}) },
      notifications: { ...DEFAULT_CONFIG.notifications, ...(loaded.notifications ?? {}) },
      features: { ...DEFAULT_CONFIG.features, ...(loaded.features ?? {}) },
    };
    this.cache.set(restaurantId, merged);
    return merged;
  }

  async getGroup<G extends ConfigGroup>(restaurantId: string, group: G): Promise<GroupPayload<G>> {
    const cfg = await this.get(restaurantId);
    return (cfg as any)[group];
  }

  validate<G extends ConfigGroup>(group: G, value: GroupPayload<G>): ValidationResult {
    return validateGroup(group, value);
  }

  async update<G extends ConfigGroup>(
    restaurantId: string, group: G, value: GroupPayload<G>, changedBy?: string,
  ): Promise<{ ok: true; version: number } | { ok: false; issues: ValidationResult["issues"] }> {
    const result = this.validate(group, value);
    if (!result.valid) return { ok: false, issues: result.issues };

    const previous = await this.get(restaurantId);
    await this.repo.saveGroup(restaurantId, group, value);
    const version = await this.repo.bumpVersion(restaurantId);

    if (this.versioning) await this.versioning.record(restaurantId, group, value, changedBy);
    if (this.audit) {
      await this.audit.diff(
        restaurantId, group, (previous as any)[group] as Record<string, any>,
        value as Record<string, any>, changedBy,
      );
    }
    this.cache.invalidate(restaurantId);
    return { ok: true, version };
  }

  async rollback<G extends ConfigGroup>(
    restaurantId: string, group: G, targetVersion: number, changedBy?: string,
  ): Promise<{ ok: true; version: number }> {
    if (!this.versioning) throw new Error("Versioning is not configured");
    const snapshot = await this.versioning.rollback(restaurantId, group, targetVersion);
    const result = await this.update(restaurantId, group, snapshot, changedBy);
    if (!result.ok) throw new Error("Rollback failed: snapshot invalid under current rules");
    return { ok: true, version: result.version };
  }

  invalidate(restaurantId: string) {
    this.cache.invalidate(restaurantId);
  }
}

export function createTenantConfigurationService(
  repo: TenantConfigRepository,
  extras?: { versioningRepo?: VersioningRepository; auditRepo?: AuditRepository; cache?: TenantConfigurationCache },
): TenantConfigurationService {
  return new TenantConfigurationService({
    repo,
    versioning: extras?.versioningRepo ? new TenantConfigurationVersioning(extras.versioningRepo) : undefined,
    audit: extras?.auditRepo ? new TenantAudit(extras.auditRepo) : undefined,
    cache: extras?.cache,
  });
}
