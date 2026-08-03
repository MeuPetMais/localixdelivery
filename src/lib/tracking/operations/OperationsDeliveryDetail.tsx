// Delivery detail is read-only. It never changes delivery state.

import type { OperationsDetail } from "./operations-tracking.types";

function mapEmbed(lat: number, lng: number): string {
  const d = 0.02;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export function OperationsDeliveryDetail({ detail }: { detail: OperationsDetail }) {
  const s = detail.snapshot;
  const hasDriverPoint = s.last_lat != null && s.last_lng != null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-3 text-sm">
        <p className="font-medium">
          Pedido {detail.order?.order_number ? `#${detail.order.order_number}` : s.order_id.slice(0, 8)}
        </p>
        <p className="text-xs text-muted-foreground">
          Status: {s.status} | ETA: {s.eta_seconds != null ? Math.round(s.eta_seconds / 60) + "min" : "-"} | Confianca: {s.confidence}
        </p>
        <p className="text-xs text-muted-foreground">
          Ultima atualizacao: {s.last_seen_at ? new Date(s.last_seen_at).toLocaleTimeString() : "-"}
        </p>
        {s.last_accuracy != null && (
          <p className="text-xs text-muted-foreground">Precisao: {Math.round(s.last_accuracy)}m</p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {hasDriverPoint ? (
          <iframe
            title="Mapa da entrega"
            src={mapEmbed(s.last_lat!, s.last_lng!)}
            className="h-64 w-full border-0"
            loading="lazy"
          />
        ) : (
          <div className="grid h-40 place-items-center text-xs text-muted-foreground">
            Sem localizacao recente do motoboy.
          </div>
        )}
        <div className="grid gap-1 border-t p-3 text-xs text-muted-foreground">
          <span>Restaurante: {detail.restaurant?.address ?? detail.restaurant?.name ?? "Nao informado"}</span>
          <span>Destino: {detail.order?.address ?? "Nao informado"}</span>
          <span>Motoboy: {hasDriverPoint ? "localizacao recebida" : "sem sinal recente"}</span>
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Timeline</h4>
        <ol className="space-y-1.5">
          {detail.timeline.map((event) => (
            <li key={event.id} className="flex gap-2 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <p className="font-medium">{event.event}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleTimeString()} | {event.actor}
                  {event.previous_status && event.current_status
                    ? ` | ${event.previous_status} -> ${event.current_status}`
                    : ""}
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
