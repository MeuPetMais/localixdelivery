import type { DashboardAuditEvent } from "./types";

type Listener = (event: DashboardAuditEvent) => void;

const listeners = new Set<Listener>();
const buffer: DashboardAuditEvent[] = [];
const MAX_BUFFER = 200;

export const DashboardAudit = {
  record(event: Omit<DashboardAuditEvent, "at"> & { at?: string }): void {
    const full: DashboardAuditEvent = { ...event, at: event.at ?? new Date().toISOString() };
    buffer.push(full);
    if (buffer.length > MAX_BUFFER) buffer.shift();
    listeners.forEach((l) => {
      try { l(full); } catch { /* noop */ }
    });
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  recent(): DashboardAuditEvent[] {
    return [...buffer];
  },
  clear(): void {
    buffer.length = 0;
  },
};
