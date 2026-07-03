// In-process event bus for the Reports & Executive Intelligence module.
// Consumed by NotificationCenter adapters and audit tooling.
export type ReportEventType =
  | "ReportRequested"
  | "ReportGenerated"
  | "ReportExported"
  | "ReportScheduled"
  | "ReportDelivered";

export interface ReportEvent {
  type: ReportEventType;
  restaurantId: string;
  payload?: Record<string, unknown>;
  at: string;
}

type Listener = (e: ReportEvent) => void;

class Bus {
  private listeners = new Set<Listener>();
  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  emit(e: Omit<ReportEvent, "at">) {
    const ev: ReportEvent = { ...e, at: new Date().toISOString() };
    for (const l of this.listeners) { try { l(ev); } catch { /* noop */ } }
  }
}

export const ReportEventBus = new Bus();
