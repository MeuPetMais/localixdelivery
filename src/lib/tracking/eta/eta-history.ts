// ETA History — store em memória para testes/uso local. Persistência remota vai em eta.functions.

import type { EtaHistoryRecord } from "./eta.types";

export interface EtaHistoryStore {
  append(record: Omit<EtaHistoryRecord, "id" | "created_at"> & { id?: string; created_at?: string }): EtaHistoryRecord;
  list(assignmentId: string): EtaHistoryRecord[];
  clear(): void;
}

let seq = 0;
const nextId = () => `eta_${Date.now()}_${++seq}`;

export function createInMemoryEtaHistoryStore(): EtaHistoryStore {
  const rows: EtaHistoryRecord[] = [];
  return {
    append(record) {
      const row: EtaHistoryRecord = {
        id: record.id ?? nextId(),
        created_at: record.created_at ?? new Date().toISOString(),
        assignment_id: record.assignment_id,
        restaurant_id: record.restaurant_id,
        order_id: record.order_id,
        driver_id: record.driver_id ?? null,
        predicted_eta_seconds: record.predicted_eta_seconds,
        actual_eta_seconds: record.actual_eta_seconds ?? null,
        difference_seconds: record.difference_seconds ?? null,
        confidence: record.confidence,
        algorithm: record.algorithm,
        window_min_seconds: record.window_min_seconds ?? null,
        window_max_seconds: record.window_max_seconds ?? null,
        correlation_id: record.correlation_id ?? null,
        metadata: record.metadata ?? {},
      };
      rows.push(row);
      return row;
    },
    list(assignmentId) {
      return rows.filter((r) => r.assignment_id === assignmentId);
    },
    clear() { rows.length = 0; },
  };
}
