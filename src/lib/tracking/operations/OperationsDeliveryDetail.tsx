// Detalhe da entrega — read-only. Nunca permite alterar estados.

import type { OperationsDetail } from "./operations-tracking.types";

export function OperationsDeliveryDetail({ detail }: { detail: OperationsDetail }) {
  const s = detail.snapshot;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-3 text-sm">
        <p className="font-medium">Pedido {s.order_id.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground">
          Status: {s.status} • ETA: {s.eta_seconds != null ? Math.round(s.eta_seconds / 60) + "min" : "—"} • Confiança: {s.confidence}
        </p>
        <p className="text-xs text-muted-foreground">
          Última atualização: {s.last_seen_at ? new Date(s.last_seen_at).toLocaleTimeString() : "—"}
        </p>
      </div>
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Timeline</h4>
        <ol className="space-y-1.5">
          {detail.timeline.map((e) => (
            <li key={e.id} className="flex gap-2 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <p className="font-medium">{e.event}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleTimeString()} • {e.actor}
                  {e.previous_status && e.current_status ? ` • ${e.previous_status} → ${e.current_status}` : ""}
                </p>
              </div>
            </li>
          ))}
          {detail.timeline.length === 0 && (
            <li className="text-xs text-muted-foreground">Sem eventos.</li>
          )}
        </ol>
      </div>
    </div>
  );
}
