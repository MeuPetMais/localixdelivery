// Operations Tracking Dashboard — visão operacional agregada.
// Desktop-first, responsivo. NUNCA permite alterar estados (apenas leitura).

import { useMemo, useState } from "react";
import { AlertTriangle, Bike, Clock, PackageCheck, Users, Search, Radio } from "lucide-react";
import type {
  OperationsActiveDelivery, OperationsDashboardData, OperationsFilters,
} from "./operations-tracking.types";
import { applyFilters } from "./operations-filters";

function fmtEta(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.max(0, Math.round(seconds / 60));
  return `${m}min`;
}

function confidenceColor(c: string): string {
  if (c === "HIGH") return "text-emerald-600";
  if (c === "LOW") return "text-red-600";
  return "text-amber-600";
}

export function OperationsTrackingDashboard({
  data, onSelect,
}: {
  data: OperationsDashboardData;
  onSelect?: (d: OperationsActiveDelivery) => void;
}) {
  const [filters, setFilters] = useState<OperationsFilters>({});
  const filteredActive = useMemo(() => applyFilters(data.active, filters), [data.active, filters]);

  return (
    <div className="space-y-4">
      {/* Cards principais */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Entregas Ativas" icon={<PackageCheck className="h-4 w-4" />}>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold">{data.metrics.active_deliveries}</span>
            <span className="text-xs text-muted-foreground">
              ETA médio {fmtEta(data.metrics.avg_eta_seconds)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Maior atraso: <strong>{data.metrics.max_delay_minutes}min</strong>
          </p>
        </Card>

        <Card title="Motoboys" icon={<Bike className="h-4 w-4" />}>
          <div className="grid grid-cols-5 gap-1 text-center text-xs">
            <Tally label="Disp." value={data.tally.disponivel} />
            <Tally label="Entr." value={data.tally.em_entrega} />
            <Tally label="Ret." value={data.tally.retornando} />
            <Tally label="Pausa" value={data.tally.pausado} />
            <Tally label="Off" value={data.tally.offline} />
          </div>
        </Card>

        <Card title="Fila" icon={<Users className="h-4 w-4" />}>
          <span className="text-3xl font-semibold">{data.queue.length}</span>
          <p className="text-xs text-muted-foreground mt-1">
            Próximo: <strong>{data.queue[0]?.driver_name ?? "—"}</strong>
          </p>
        </Card>

        <Card title="Indicadores" icon={<Clock className="h-4 w-4" />}>
          <ul className="space-y-1 text-xs">
            <li>Entrega média: <strong>{data.metrics.avg_delivery_minutes ?? "—"}min</strong></li>
            <li>Espera fila: <strong>{data.metrics.avg_wait_minutes ?? "—"}min</strong></li>
            <li>Confiança ETA: <strong className={confidenceColor(data.metrics.avg_confidence)}>
              {data.metrics.avg_confidence}
            </strong></li>
          </ul>
        </Card>
      </div>

      {/* Alertas */}
      {data.alerts.length > 0 && (
        <Card title={`Alertas (${data.alerts.length})`} icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}>
          <ul className="space-y-1.5 max-h-56 overflow-auto">
            {data.alerts.map((a) => (
              <li key={a.id} className={
                "rounded-md border px-3 py-2 text-xs " +
                (a.severity === "critical" ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                  : a.severity === "warn" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                  : "border-border bg-muted/30")
              }>
                <p className="font-medium">{a.title}</p>
                <p className="text-muted-foreground">{a.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Filtros + Busca */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-md border bg-background pl-8 pr-3 py-2 text-sm"
            placeholder="Buscar pedido, cliente ou motoboy"
            value={filters.search ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <select
          className="rounded-md border bg-background px-2 py-2 text-sm"
          value={filters.driverId ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, driverId: e.target.value || undefined }))}
        >
          <option value="">Todos motoboys</option>
          {data.drivers.map((d) => (<option key={d.driver_id} value={d.driver_id}>{d.name}</option>))}
        </select>
      </div>

      {/* Entregas ativas */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-2">
          <h3 className="text-sm font-semibold">Entregas em andamento</h3>
          <ul className="space-y-2">
            {filteredActive.map((d) => (
              <li key={d.assignment_id}>
                <button
                  onClick={() => onSelect?.(d)}
                  className="w-full rounded-lg border bg-card p-3 text-left hover:bg-muted/40 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        #{d.order_number ?? "—"} • {d.customer_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.driver_name} • {d.neighborhood ?? "—"} • {d.minutes_since_start}min
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs uppercase tracking-wide">{d.status}</p>
                      <p className={"text-xs " + confidenceColor(d.confidence)}>
                        ETA {fmtEta(d.eta_seconds)}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {filteredActive.length === 0 && (
              <li className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                Nenhuma entrega ativa.
              </li>
            )}
          </ul>
        </div>

        <div className="space-y-3">
          <Card title="Fila de motoboys" icon={<Users className="h-4 w-4" />}>
            <ol className="space-y-1.5 text-sm">
              {data.queue.map((q) => (
                <li key={q.driver_id} className="flex items-center justify-between">
                  <span>{q.position}. {q.driver_name}</span>
                  <span className="text-xs text-muted-foreground">{q.waiting_minutes}min</span>
                </li>
              ))}
              {data.queue.length === 0 && (
                <li className="text-xs text-muted-foreground">Fila vazia.</li>
              )}
            </ol>
          </Card>

          <Card title="Motoboys" icon={<Radio className="h-4 w-4" />}>
            <ul className="space-y-1.5 text-sm max-h-72 overflow-auto">
              {data.drivers.map((d) => (
                <li key={d.driver_id} className="flex items-center justify-between">
                  <span className="truncate">{d.name}</span>
                  <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 uppercase">
                    {d.state}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}{title}
      </div>
      {children}
    </div>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 p-1.5">
      <p className="text-base font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
