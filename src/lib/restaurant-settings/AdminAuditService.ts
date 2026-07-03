import type { AdminAuditEntry, AdminAuditRepository } from "./types";

export class AdminAuditService {
  constructor(private readonly repo: AdminAuditRepository) {}

  record(entry: AdminAuditEntry) { return this.repo.insert(entry); }

  list(restaurantId: string, limit = 50) { return this.repo.list(restaurantId, limit); }

  async diff<T extends Record<string, unknown>>(
    restaurantId: string, group: AdminAuditEntry["group_name"],
    before: T, after: T, changedBy?: string,
  ): Promise<AdminAuditEntry[]> {
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    const entries: AdminAuditEntry[] = [];
    for (const k of keys) {
      if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) {
        const e: AdminAuditEntry = {
          restaurant_id: restaurantId, group_name: group, field: k,
          old_value: before?.[k] ?? null, new_value: after?.[k] ?? null,
          changed_by: changedBy ?? null, source: "admin",
        };
        entries.push(e);
        await this.repo.insert(e);
      }
    }
    return entries;
  }
}
