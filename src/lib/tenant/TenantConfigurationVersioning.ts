import type { ConfigGroup, GroupPayload } from "./types";

export interface VersionRow<G extends ConfigGroup = ConfigGroup> {
  restaurant_id: string;
  group_name: G;
  version: number;
  snapshot: GroupPayload<G>;
  changed_by?: string | null;
  created_at: string;
}

export interface VersioningRepository {
  append<G extends ConfigGroup>(row: Omit<VersionRow<G>, "created_at">): Promise<VersionRow<G>>;
  latest<G extends ConfigGroup>(restaurantId: string, group: G): Promise<VersionRow<G> | null>;
  history<G extends ConfigGroup>(restaurantId: string, group: G, limit?: number): Promise<VersionRow<G>[]>;
  at<G extends ConfigGroup>(restaurantId: string, group: G, version: number): Promise<VersionRow<G> | null>;
}

export class TenantConfigurationVersioning {
  constructor(private repo: VersioningRepository) {}

  async record<G extends ConfigGroup>(
    restaurantId: string, group: G, snapshot: GroupPayload<G>, changedBy?: string,
  ): Promise<VersionRow<G>> {
    const latest = await this.repo.latest(restaurantId, group);
    const nextVersion = (latest?.version ?? 0) + 1;
    return this.repo.append({
      restaurant_id: restaurantId, group_name: group, version: nextVersion,
      snapshot, changed_by: changedBy ?? null,
    });
  }

  async rollback<G extends ConfigGroup>(
    restaurantId: string, group: G, targetVersion: number,
  ): Promise<GroupPayload<G>> {
    const row = await this.repo.at(restaurantId, group, targetVersion);
    if (!row) throw new Error(`Version ${targetVersion} not found for ${group}`);
    return row.snapshot;
  }

  history<G extends ConfigGroup>(restaurantId: string, group: G, limit = 20) {
    return this.repo.history(restaurantId, group, limit);
  }
}
