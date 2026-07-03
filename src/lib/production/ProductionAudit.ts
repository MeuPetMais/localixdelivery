export interface AuditEntry {
  at: string;
  who: string | null;
  action: string;
  productionId: string;
  data?: Record<string, unknown>;
}

const entries: AuditEntry[] = [];

export const ProductionAudit = {
  record(e: Omit<AuditEntry, "at">) { entries.push({ ...e, at: new Date().toISOString() }); },
  list(): AuditEntry[] { return entries.slice(); },
  clear() { entries.length = 0; },
};
