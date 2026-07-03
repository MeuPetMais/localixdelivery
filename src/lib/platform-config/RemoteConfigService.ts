import type { EvaluationContext, RemoteConfigEntry } from "./types";
import { isWithinRollout } from "./rollout";

export interface RemoteConfigVersion<T = unknown> {
  version: number;
  snapshot: RemoteConfigEntry<T>;
  changed_at: string;
  changed_by: string;
  reason?: string;
}

export interface RemoteConfigRepository {
  get(key: string): RemoteConfigEntry | undefined;
  list(): RemoteConfigEntry[];
  save(entry: RemoteConfigEntry): void;
  remove(key: string): void;
  versions(key: string): RemoteConfigVersion[];
  pushVersion(v: RemoteConfigVersion): void;
}

export class InMemoryRemoteConfigRepository implements RemoteConfigRepository {
  private entries = new Map<string, RemoteConfigEntry>();
  private history = new Map<string, RemoteConfigVersion[]>();
  get(k: string) { return this.entries.get(k); }
  list() { return [...this.entries.values()]; }
  save(e: RemoteConfigEntry) { this.entries.set(e.key, e); }
  remove(k: string) { this.entries.delete(k); }
  versions(k: string) { return this.history.get(k) ?? []; }
  pushVersion(v: RemoteConfigVersion) {
    const list = this.history.get(v.snapshot.key) ?? [];
    list.push(Object.freeze(v));
    this.history.set(v.snapshot.key, list);
  }
}

export class RemoteConfigService {
  constructor(private readonly repo: RemoteConfigRepository = new InMemoryRemoteConfigRepository()) {}

  list(): RemoteConfigEntry[] { return this.repo.list(); }
  get<T = unknown>(key: string): RemoteConfigEntry<T> | undefined {
    return this.repo.get(key) as RemoteConfigEntry<T> | undefined;
  }
  history(key: string): RemoteConfigVersion[] { return this.repo.versions(key); }

  set<T>(input: {
    key: string; value: T; description?: string;
    scope: RemoteConfigEntry["scope"]; targeting?: RemoteConfigEntry["targeting"];
    actorId: string; reason?: string;
  }): RemoteConfigEntry<T> {
    const current = this.repo.get(input.key);
    const version = (current?.version ?? 0) + 1;
    const now = new Date().toISOString();
    const entry: RemoteConfigEntry<T> = {
      key: input.key, value: input.value,
      description: input.description ?? current?.description,
      version, updated_at: now, updated_by: input.actorId,
      scope: input.scope, targeting: input.targeting,
    };
    this.repo.save(entry);
    this.repo.pushVersion({ version, snapshot: entry, changed_at: now, changed_by: input.actorId, reason: input.reason });
    return entry;
  }

  rollback(key: string, toVersion: number, actorId: string, reason?: string): RemoteConfigEntry {
    const versions = this.repo.versions(key);
    const target = versions.find((v) => v.version === toVersion);
    if (!target) throw new Error(`Version ${toVersion} not found for ${key}`);
    return this.set({
      key,
      value: target.snapshot.value,
      description: target.snapshot.description,
      scope: target.snapshot.scope,
      targeting: target.snapshot.targeting,
      actorId,
      reason: reason ?? `rollback:${toVersion}`,
    });
  }

  /** Resolve o valor considerando targeting + rollout gradual. Retorna `fallback` quando não aplicável. */
  resolve<T>(key: string, ctx: EvaluationContext = {}, fallback?: T): T | undefined {
    const entry = this.repo.get(key) as RemoteConfigEntry<T> | undefined;
    if (!entry) return fallback;
    const t = entry.targeting ?? {};
    if (t.environments?.length && ctx.environment && !t.environments.includes(ctx.environment)) return fallback;
    if (t.regions?.length && ctx.region && !t.regions.includes(ctx.region)) return fallback;
    if (t.channels?.length && ctx.channel && !t.channels.includes(ctx.channel)) return fallback;
    if (t.plans?.length && ctx.plan && !t.plans.includes(ctx.plan)) return fallback;
    if (t.tenants?.length && ctx.tenantId && !t.tenants.includes(ctx.tenantId)) return fallback;
    if (typeof t.rollout_percent === "number") {
      const bucket = ctx.bucketKey ?? ctx.tenantId ?? key;
      if (!isWithinRollout(`${key}:${bucket}`, t.rollout_percent)) return fallback;
    }
    return entry.value;
  }
}
