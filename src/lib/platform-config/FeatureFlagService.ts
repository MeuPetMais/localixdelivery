import type { FeatureFlag, FlagTargeting } from "./types";

export interface FeatureFlagVersion {
  version: number;
  snapshot: FeatureFlag;
  changed_at: string;
  changed_by: string;
  reason?: string;
}

export interface FeatureFlagRepository {
  get(key: string): FeatureFlag | undefined;
  list(): FeatureFlag[];
  save(flag: FeatureFlag): void;
  remove(key: string): void;
  versions(key: string): FeatureFlagVersion[];
  pushVersion(v: FeatureFlagVersion): void;
}

export class InMemoryFeatureFlagRepository implements FeatureFlagRepository {
  private flags = new Map<string, FeatureFlag>();
  private history = new Map<string, FeatureFlagVersion[]>();
  get(key: string) { return this.flags.get(key); }
  list() { return [...this.flags.values()]; }
  save(flag: FeatureFlag) { this.flags.set(flag.key, flag); }
  remove(key: string) { this.flags.delete(key); }
  versions(key: string) { return this.history.get(key) ?? []; }
  pushVersion(v: FeatureFlagVersion) {
    const list = this.history.get(v.snapshot.key) ?? [];
    list.push(Object.freeze(v));
    this.history.set(v.snapshot.key, list);
  }
}

export interface FlagChangeInput {
  key: string;
  name?: string;
  description?: string;
  default_value?: boolean;
  targeting?: Partial<FlagTargeting>;
  status?: FeatureFlag["status"];
  scope?: FeatureFlag["scope"];
}

export class FeatureFlagService {
  constructor(private readonly repo: FeatureFlagRepository = new InMemoryFeatureFlagRepository()) {}

  list(): FeatureFlag[] { return this.repo.list(); }
  get(key: string): FeatureFlag | undefined { return this.repo.get(key); }
  history(key: string): FeatureFlagVersion[] { return this.repo.versions(key); }

  create(input: {
    key: string; name: string; description: string;
    scope: FeatureFlag["scope"]; default_value?: boolean;
    targeting?: FlagTargeting; actorId: string;
  }): FeatureFlag {
    if (this.repo.get(input.key)) throw new Error(`Flag already exists: ${input.key}`);
    const now = new Date().toISOString();
    const flag: FeatureFlag = {
      key: input.key,
      name: input.name,
      description: input.description,
      status: "active",
      scope: input.scope,
      default_value: input.default_value ?? false,
      targeting: input.targeting ?? {},
      version: 1,
      created_at: now,
      created_by: input.actorId,
      updated_at: now,
      updated_by: input.actorId,
      killed: false,
    };
    this.repo.save(flag);
    this.repo.pushVersion({ version: 1, snapshot: flag, changed_at: now, changed_by: input.actorId, reason: "created" });
    return flag;
  }

  update(input: FlagChangeInput & { actorId: string; reason?: string }): FeatureFlag {
    const current = this.mustGet(input.key);
    const next: FeatureFlag = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      default_value: input.default_value ?? current.default_value,
      targeting: { ...current.targeting, ...(input.targeting ?? {}) },
      status: input.status ?? current.status,
      scope: input.scope ?? current.scope,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
      updated_by: input.actorId,
    };
    this.repo.save(next);
    this.repo.pushVersion({
      version: next.version, snapshot: next,
      changed_at: next.updated_at!, changed_by: input.actorId, reason: input.reason,
    });
    return next;
  }

  setRolloutPercent(key: string, percent: number, actorId: string, reason?: string): FeatureFlag {
    if (percent < 0 || percent > 100) throw new Error("percent must be 0..100");
    return this.update({ key, targeting: { rollout_percent: percent }, actorId, reason });
  }

  enable(key: string, actorId: string, reason?: string): FeatureFlag {
    return this.update({ key, status: "active", actorId, reason });
  }
  disable(key: string, actorId: string, reason?: string): FeatureFlag {
    return this.update({ key, status: "disabled", actorId, reason });
  }
  archive(key: string, actorId: string, reason?: string): FeatureFlag {
    return this.update({ key, status: "archived", actorId, reason });
  }

  kill(key: string, actorId: string, reason?: string): FeatureFlag {
    const current = this.mustGet(key);
    const next: FeatureFlag = {
      ...current, killed: true,
      version: current.version + 1,
      updated_at: new Date().toISOString(), updated_by: actorId,
    };
    this.repo.save(next);
    this.repo.pushVersion({ version: next.version, snapshot: next, changed_at: next.updated_at!, changed_by: actorId, reason: reason ?? "killed" });
    return next;
  }
  revive(key: string, actorId: string, reason?: string): FeatureFlag {
    const current = this.mustGet(key);
    const next: FeatureFlag = {
      ...current, killed: false,
      version: current.version + 1,
      updated_at: new Date().toISOString(), updated_by: actorId,
    };
    this.repo.save(next);
    this.repo.pushVersion({ version: next.version, snapshot: next, changed_at: next.updated_at!, changed_by: actorId, reason: reason ?? "revived" });
    return next;
  }

  rollback(key: string, toVersion: number, actorId: string, reason?: string): FeatureFlag {
    const versions = this.repo.versions(key);
    const target = versions.find((v) => v.version === toVersion);
    if (!target) throw new Error(`Version ${toVersion} not found for ${key}`);
    const current = this.mustGet(key);
    const restored: FeatureFlag = {
      ...target.snapshot,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    };
    this.repo.save(restored);
    this.repo.pushVersion({
      version: restored.version, snapshot: restored,
      changed_at: restored.updated_at!, changed_by: actorId,
      reason: reason ?? `rollback:${toVersion}`,
    });
    return restored;
  }

  private mustGet(key: string): FeatureFlag {
    const flag = this.repo.get(key);
    if (!flag) throw new Error(`Flag not found: ${key}`);
    return flag;
  }
}
