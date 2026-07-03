// Facade central — Global Configuration Center.
// Orquestra FeatureFlagService + RemoteConfigService + KillSwitchService
// + PlanFeatureService, publica eventos e registra auditoria imutável.
//
// Consumidores devem SEMPRE consultar este facade — nunca configurações
// isoladas por módulo.

import { FeatureFlagService, InMemoryFeatureFlagRepository, type FeatureFlagRepository } from "./FeatureFlagService";
import { RemoteConfigService, InMemoryRemoteConfigRepository, type RemoteConfigRepository } from "./RemoteConfigService";
import { KillSwitchService, InMemoryKillSwitchRepository, type KillSwitchRepository } from "./KillSwitchService";
import { PlanFeatureService, InMemoryPlanFeatureRepository, type PlanFeatureRepository } from "./PlanFeatureService";
import { PlatformConfigAuditService, InMemoryPlatformConfigAuditRepository, type PlatformConfigAuditRepository } from "./PlatformConfigAuditService";
import { PlatformConfigEventBus } from "./PlatformConfigEventBus";
import { FeatureFlagEngine } from "./FeatureFlagEngine";
import type { EvaluationContext, FeatureFlag, FlagTargeting, KillSwitchDomain, RemoteConfigEntry } from "./types";
import type { PlanTier } from "@/lib/platform/types";

export interface PlatformConfigDeps {
  flags?: FeatureFlagRepository;
  remoteConfig?: RemoteConfigRepository;
  killSwitch?: KillSwitchRepository;
  planFeatures?: PlanFeatureRepository;
  audit?: PlatformConfigAuditRepository;
}

interface Cached<T> { value: T; at: number }

export class PlatformConfigurationService {
  readonly flags: FeatureFlagService;
  readonly remoteConfig: RemoteConfigService;
  readonly killSwitch: KillSwitchService;
  readonly planFeatures: PlanFeatureService;
  readonly audit: PlatformConfigAuditService;

  private evalCache = new Map<string, Cached<boolean>>();
  private cacheTtlMs = 5_000;

  constructor(deps: PlatformConfigDeps = {}) {
    this.flags = new FeatureFlagService(deps.flags ?? new InMemoryFeatureFlagRepository());
    this.remoteConfig = new RemoteConfigService(deps.remoteConfig ?? new InMemoryRemoteConfigRepository());
    this.killSwitch = new KillSwitchService(deps.killSwitch ?? new InMemoryKillSwitchRepository());
    this.planFeatures = new PlanFeatureService(deps.planFeatures ?? new InMemoryPlanFeatureRepository());
    this.audit = new PlatformConfigAuditService(deps.audit ?? new InMemoryPlatformConfigAuditRepository());
  }

  private cacheKey(flagKey: string, ctx: EvaluationContext): string {
    return [flagKey, ctx.tenantId ?? "-", ctx.plan ?? "-", ctx.environment ?? "-", ctx.region ?? "-", ctx.channel ?? "-", ctx.bucketKey ?? "-"].join("|");
  }

  isFeatureEnabled(key: string, ctx: EvaluationContext = {}): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;
    const ck = this.cacheKey(key, ctx);
    const hit = this.evalCache.get(ck);
    if (hit && Date.now() - hit.at < this.cacheTtlMs) return hit.value;
    const enabled = FeatureFlagEngine.isEnabled(flag, ctx);
    this.evalCache.set(ck, { value: enabled, at: Date.now() });
    return enabled;
  }

  invalidateCache(): void { this.evalCache.clear(); }

  // --- Flags -----------------------------------------------------------
  async createFlag(input: Parameters<FeatureFlagService["create"]>[0]): Promise<FeatureFlag> {
    const flag = this.flags.create(input);
    await this.audit.record({ actor_id: input.actorId, action: "flag.created", target_key: flag.key, to_version: flag.version, after: flag });
    await PlatformConfigEventBus.publish({ type: "FlagChanged", key: flag.key, version: flag.version, actorId: input.actorId });
    this.invalidateCache();
    return flag;
  }

  async updateFlag(input: { key: string; actorId: string; reason?: string; name?: string; description?: string; default_value?: boolean; targeting?: Partial<FlagTargeting>; status?: FeatureFlag["status"] }): Promise<FeatureFlag> {
    const before = this.flags.get(input.key);
    const next = this.flags.update(input);
    await this.audit.record({
      actor_id: input.actorId, action: "flag.updated",
      target_key: next.key, from_version: before?.version ?? null, to_version: next.version,
      reason: input.reason, before, after: next,
    });
    await PlatformConfigEventBus.publish({ type: "FlagChanged", key: next.key, version: next.version, actorId: input.actorId });
    this.invalidateCache();
    return next;
  }

  async setRolloutPercent(key: string, percent: number, actorId: string, reason?: string): Promise<FeatureFlag> {
    const before = this.flags.get(key);
    const next = this.flags.setRolloutPercent(key, percent, actorId, reason);
    await this.audit.record({
      actor_id: actorId, action: "flag.rollout_changed",
      target_key: key, from_version: before?.version ?? null, to_version: next.version,
      reason, before, after: next,
    });
    await PlatformConfigEventBus.publish({ type: "FlagChanged", key, version: next.version, actorId });
    this.invalidateCache();
    return next;
  }

  async killFlag(key: string, actorId: string, reason?: string): Promise<FeatureFlag> {
    const next = this.flags.kill(key, actorId, reason);
    await this.audit.record({ actor_id: actorId, action: "flag.killed", target_key: key, to_version: next.version, reason, after: next });
    await PlatformConfigEventBus.publish({ type: "FlagKilled", key, actorId });
    this.invalidateCache();
    return next;
  }
  async reviveFlag(key: string, actorId: string, reason?: string): Promise<FeatureFlag> {
    const next = this.flags.revive(key, actorId, reason);
    await this.audit.record({ actor_id: actorId, action: "flag.revived", target_key: key, to_version: next.version, reason, after: next });
    await PlatformConfigEventBus.publish({ type: "FlagRevived", key, actorId });
    this.invalidateCache();
    return next;
  }

  async rollbackFlag(key: string, toVersion: number, actorId: string, reason?: string): Promise<FeatureFlag> {
    const before = this.flags.get(key);
    const next = this.flags.rollback(key, toVersion, actorId, reason);
    await this.audit.record({
      actor_id: actorId, action: "flag.rolled_back",
      target_key: key, from_version: before?.version ?? null, to_version: next.version,
      reason: reason ?? `rollback:${toVersion}`, before, after: next,
    });
    await PlatformConfigEventBus.publish({ type: "FlagRolledBack", key, toVersion, actorId });
    this.invalidateCache();
    return next;
  }

  // --- Remote config ---------------------------------------------------
  async setConfig<T>(input: Parameters<RemoteConfigService["set"]>[0]): Promise<RemoteConfigEntry<T>> {
    const before = this.remoteConfig.get(input.key);
    const entry = this.remoteConfig.set<T>(input);
    await this.audit.record({
      actor_id: input.actorId, action: "config.set",
      target_key: entry.key, from_version: before?.version ?? null, to_version: entry.version,
      reason: input.reason, before, after: entry,
    });
    await PlatformConfigEventBus.publish({ type: "RemoteConfigChanged", key: entry.key, version: entry.version, actorId: input.actorId });
    return entry;
  }

  async rollbackConfig(key: string, toVersion: number, actorId: string, reason?: string): Promise<RemoteConfigEntry> {
    const before = this.remoteConfig.get(key);
    const entry = this.remoteConfig.rollback(key, toVersion, actorId, reason);
    await this.audit.record({
      actor_id: actorId, action: "config.rolled_back",
      target_key: key, from_version: before?.version ?? null, to_version: entry.version,
      reason: reason ?? `rollback:${toVersion}`, before, after: entry,
    });
    await PlatformConfigEventBus.publish({ type: "RemoteConfigChanged", key, version: entry.version, actorId });
    return entry;
  }

  // --- Plan features ---------------------------------------------------
  async updatePlanFeatures(input: Parameters<PlanFeatureService["updateFeatures"]>[0]): Promise<void> {
    const next = this.planFeatures.updateFeatures(input);
    await this.audit.record({
      actor_id: input.actorId, action: "plan.features_updated",
      target_key: `plan:${input.plan}`, to_version: next.version, after: next,
    });
    await PlatformConfigEventBus.publish({ type: "PlanFeaturesUpdated", plan: input.plan, actorId: input.actorId });
  }

  planHasFeature(plan: PlanTier, feature: string): boolean {
    return this.planFeatures.hasFeature(plan, feature);
  }

  // --- Kill switches ---------------------------------------------------
  async activateKillSwitch(domain: KillSwitchDomain | string, actorId: string, reason?: string): Promise<void> {
    this.killSwitch.activate(domain, actorId, reason);
    await this.audit.record({ actor_id: actorId, action: "kill_switch.activated", target_key: `kill:${domain}`, reason });
    await PlatformConfigEventBus.publish({ type: "KillSwitchToggled", domain, active: true, actorId });
  }
  async deactivateKillSwitch(domain: KillSwitchDomain | string, actorId: string): Promise<void> {
    this.killSwitch.deactivate(domain, actorId);
    await this.audit.record({ actor_id: actorId, action: "kill_switch.deactivated", target_key: `kill:${domain}` });
    await PlatformConfigEventBus.publish({ type: "KillSwitchToggled", domain, active: false, actorId });
  }
  isKillSwitchActive(domain: KillSwitchDomain | string): boolean { return this.killSwitch.isActive(domain); }
}

// Instância singleton conveniente para consumidores que não injetam repositórios.
export const platformConfiguration = new PlatformConfigurationService();
