// Platform Configuration & Feature Flag System — tipos
// Domínio central de configuração da plataforma Localix.

import type { PlanTier } from "@/lib/platform/types";

export type Environment = "dev" | "staging" | "prod";
export type Region = "default" | "br-south" | "br-north" | "latam";
export type Channel = "web" | "mobile" | "kiosk" | "whatsapp" | "api";

export type FlagStatus = "active" | "disabled" | "archived" | "experimental";
export type FlagScope = "global" | "plan" | "tenant" | "environment" | "temporary" | "experimental";

export interface FlagTargeting {
  plans?: PlanTier[];
  tenants?: string[];
  environments?: Environment[];
  regions?: Region[];
  channels?: Channel[];
  /** Percentual de rollout gradual (0..100). */
  rollout_percent?: number;
  /** Data-limite p/ flags temporárias (ISO). */
  expires_at?: string | null;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  status: FlagStatus;
  scope: FlagScope;
  default_value: boolean;
  targeting: FlagTargeting;
  version: number;
  created_at: string;
  created_by: string;
  updated_at?: string;
  updated_by?: string | null;
  /** Kill switch — quando true, força desligado em todos os escopos. */
  killed?: boolean;
}

export interface RemoteConfigEntry<T = unknown> {
  key: string;
  value: T;
  description?: string;
  version: number;
  updated_at: string;
  updated_by: string;
  scope: FlagScope;
  targeting?: FlagTargeting;
}

export type PlatformConfigAuditAction =
  | "flag.created" | "flag.updated" | "flag.enabled" | "flag.disabled"
  | "flag.archived" | "flag.rollout_changed" | "flag.killed" | "flag.revived"
  | "flag.rolled_back"
  | "config.set" | "config.rolled_back" | "config.deleted"
  | "plan.features_updated"
  | "kill_switch.activated" | "kill_switch.deactivated";

export interface PlatformConfigAuditEntry {
  id?: string;
  actor_id: string;
  action: PlatformConfigAuditAction;
  target_key: string;
  from_version?: number | null;
  to_version?: number | null;
  reason?: string;
  before?: unknown;
  after?: unknown;
  created_at?: string;
}

export interface EvaluationContext {
  tenantId?: string;
  plan?: PlanTier;
  environment?: Environment;
  region?: Region;
  channel?: Channel;
  /** Chave estável usada para bucketing determinístico do rollout (default: tenantId). */
  bucketKey?: string;
}

export type KillSwitchDomain =
  | "payments" | "delivery" | "promotions" | "marketplace"
  | "ai" | "analytics" | "notifications";

export interface KillSwitchState {
  domain: KillSwitchDomain | string;
  active: boolean;
  activated_at?: string | null;
  activated_by?: string | null;
  reason?: string | null;
}

export type PlatformConfigEvent =
  | { type: "FlagChanged"; key: string; version: number; actorId: string }
  | { type: "FlagKilled"; key: string; actorId: string }
  | { type: "FlagRevived"; key: string; actorId: string }
  | { type: "FlagRolledBack"; key: string; toVersion: number; actorId: string }
  | { type: "RemoteConfigChanged"; key: string; version: number; actorId: string }
  | { type: "PlanFeaturesUpdated"; plan: PlanTier; actorId: string }
  | { type: "KillSwitchToggled"; domain: string; active: boolean; actorId: string };
