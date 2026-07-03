import type { AnalyticsScope } from "./types";

export interface AnalyticsAuditEntry {
  at: string;
  actorId?: string;
  scope: AnalyticsScope;
  action: "dashboard_read" | "kpi_read" | "export" | "insight_read";
  restaurantId?: string;
  metadata?: Record<string, unknown>;
}

const log: AnalyticsAuditEntry[] = [];
const MAX = 500;

export const AnalyticsAudit = {
  record(entry: Omit<AnalyticsAuditEntry, "at"> & { at?: string }): AnalyticsAuditEntry {
    const full: AnalyticsAuditEntry = { ...entry, at: entry.at ?? new Date().toISOString() };
    log.push(full);
    if (log.length > MAX) log.splice(0, log.length - MAX);
    return full;
  },
  list(filter?: Partial<Pick<AnalyticsAuditEntry, "scope" | "action" | "restaurantId">>): AnalyticsAuditEntry[] {
    if (!filter) return [...log];
    return log.filter(e =>
      (!filter.scope || e.scope === filter.scope) &&
      (!filter.action || e.action === filter.action) &&
      (!filter.restaurantId || e.restaurantId === filter.restaurantId)
    );
  },
  _reset() { log.length = 0; },
};
