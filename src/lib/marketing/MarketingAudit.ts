export interface MarketingAuditEntry {
  id: string;
  restaurant_id: string;
  actor_id?: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  at: string;
}

const log: MarketingAuditEntry[] = [];
let seq = 0;

export const MarketingAudit = {
  record(entry: Omit<MarketingAuditEntry, "id" | "at">): MarketingAuditEntry {
    const rec: MarketingAuditEntry = {
      ...entry,
      id: `ma_${++seq}`,
      at: new Date().toISOString(),
    };
    log.push(Object.freeze({ ...rec }) as MarketingAuditEntry);
    return rec;
  },
  list(restaurantId?: string): MarketingAuditEntry[] {
    return restaurantId ? log.filter((r) => r.restaurant_id === restaurantId) : [...log];
  },
  clear(): void { log.length = 0; seq = 0; },
} as const;
