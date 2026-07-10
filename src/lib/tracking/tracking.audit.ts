// Tracking Domain — Audit sink.
// Registro observacional para depuração/rastreio. Nunca falha o fluxo principal.

export interface TrackingAuditRecord {
  action:
    | "snapshot_created"
    | "snapshot_updated"
    | "timeline_appended"
    | "status_changed";
  correlation_id: string;
  assignment_id: string;
  restaurant_id: string;
  order_id: string;
  driver_id: string | null;
  at: string;
  detail?: Record<string, unknown>;
}

type Sink = (r: TrackingAuditRecord) => void | Promise<void>;

let sink: Sink = (r) => {
  // Default: log estruturado. Substituível por sink externo em prod.
  console.info("[tracking-audit]", JSON.stringify(r));
};

export function setTrackingAuditSink(fn: Sink) { sink = fn; }

export async function recordTrackingAudit(r: TrackingAuditRecord) {
  try { await sink(r); } catch (err) { console.error("[tracking-audit] sink error", err); }
}
