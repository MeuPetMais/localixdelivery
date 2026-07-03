import type { ConfigGroup } from "./types";

export interface AuditEntry {
  restaurant_id: string;
  group_name: ConfigGroup;
  field: string;
  old_value: unknown;
  new_value: unknown;
  changed_by?: string | null;
  source?: string | null;
}

export interface AuditRepository {
  insert(entry: AuditEntry): Promise<void>;
}

export class TenantAudit {
  constructor(private repo: AuditRepository) {}

  async diff<T extends Record<string, any>>(
    restaurantId: string, group: ConfigGroup, before: T, after: T,
    changedBy?: string, source = "panel",
  ): Promise<AuditEntry[]> {
    const entries: AuditEntry[] = [];
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    for (const key of keys) {
      const a = before?.[key];
      const b = after?.[key];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        const entry: AuditEntry = {
          restaurant_id: restaurantId, group_name: group, field: key,
          old_value: a ?? null, new_value: b ?? null,
          changed_by: changedBy ?? null, source,
        };
        entries.push(entry);
        await this.repo.insert(entry);
      }
    }
    return entries;
  }
}
