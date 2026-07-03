import type { OperationsCounters, OperationsMetrics, OperationsAlert } from "@/lib/operations";

export function LiveCounters({ counters }: { counters: OperationsCounters }) {
  const items: [string, string | number][] = [
    ["Novos", counters.new],
    ["Em preparo", counters.preparing],
    ["Em entrega", counters.delivering],
    ["Finalizados hoje", counters.completedToday],
    ["Tempo médio", `${counters.averagePrepMinutes}min`],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold">{v}</p>
          <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
        </div>
      ))}
    </div>
  );
}

export function OperationalMetricsView({ metrics }: { metrics: OperationsMetrics }) {
  const items: [string, string | number][] = [
    ["Preparo (min)", metrics.avgPrepMinutes],
    ["Entrega (min)", metrics.avgDeliveryMinutes],
    ["Total (min)", metrics.avgTotalMinutes],
    ["Cancelamentos", metrics.cancellations],
    ["Pedidos/h", metrics.ordersPerHour],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg border bg-card p-3 text-center text-xs">
          <p className="text-base font-bold">{v}</p>
          <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
        </div>
      ))}
    </div>
  );
}

export function OperationalAlerts({ alerts }: { alerts: OperationsAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-1">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={
            "rounded-md border px-3 py-2 text-xs " +
            (a.severity === "critical"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400")
          }
        >
          {a.message}
        </div>
      ))}
    </div>
  );
}
