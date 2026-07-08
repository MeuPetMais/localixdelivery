import type { OperationsOrderCard } from "@/lib/operations";

export function DeliveryPanel({ cards }: { cards: OperationsOrderCard[] }) {
  const inFlight = cards.filter((c) => c.status === "saiu_para_entrega" || c.status === "pronto");
  return (
    <div className="space-y-3">
      <div className="grid h-40 place-items-center rounded-xl border bg-muted/30 text-xs text-muted-foreground">
        Mapa (placeholder)
      </div>
      <ul className="space-y-2">
        {inFlight.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{c.number} • {c.customerName}</p>
              <p className="text-xs text-muted-foreground">
                {c.driverName ?? "Sem entregador"} • ETA {c.etaMinutes ?? "—"}min
              </p>
            </div>
            <span className="text-xs uppercase text-muted-foreground">{c.status}</span>
          </li>
        ))}
        {inFlight.length === 0 && <li className="text-sm text-muted-foreground">Sem entregas em andamento.</li>}
      </ul>
    </div>
  );
}
