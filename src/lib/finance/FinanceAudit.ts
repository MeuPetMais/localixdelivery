import type { FinanceAuditEvent } from "./types";

// Lightweight in-memory audit sink. Wire to a persistent sink later.
type Sink = (event: FinanceAuditEvent) => void;
const sinks: Sink[] = [];

export const FinanceAudit = {
  emit(event: Omit<FinanceAuditEvent, "at"> & { at?: string }) {
    const full: FinanceAuditEvent = { ...event, at: event.at ?? new Date().toISOString() };
    for (const s of sinks) {
      try { s(full); } catch { /* ignore sink failures */ }
    }
    return full;
  },
  subscribe(sink: Sink) {
    sinks.push(sink);
    return () => {
      const i = sinks.indexOf(sink);
      if (i >= 0) sinks.splice(i, 1);
    };
  },
};
