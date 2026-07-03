import type { MovementType } from "./types";

export interface InventoryAuditEntry {
  who?: string;
  when: string;
  source: string;
  movement: MovementType;
  ingredientId: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

const buffer: InventoryAuditEntry[] = [];
const subscribers = new Set<(entry: InventoryAuditEntry) => void>();

export const InventoryAudit = {
  record(entry: Omit<InventoryAuditEntry, "when"> & { when?: string }) {
    const full: InventoryAuditEntry = { when: new Date().toISOString(), ...entry };
    buffer.push(full);
    if (buffer.length > 500) buffer.shift();
    subscribers.forEach((s) => { try { s(full); } catch { /* swallow */ } });
    return full;
  },
  list(): InventoryAuditEntry[] { return [...buffer]; },
  subscribe(fn: (entry: InventoryAuditEntry) => void) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
  clear() { buffer.length = 0; },
};
