// RC7.0 — Central Operacional (painel do restaurante)
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Clock, Users, Bike, Package, RotateCcw, PauseCircle, WifiOff,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getOperationsCentral, type CentralDriver, type CentralGroup, type CentralMetrics,
} from "@/lib/operations-central.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/central")({
  head: () => ({ meta: [
    { title: "Central Operacional — Localix" },
    { name: "description", content: "Painel operacional em tempo real: fila, entregas em andamento, retornos e pausas." },
  ] }),
  component: CentralPage,
});

const GROUP_META: Record<CentralGroup, { label: string; icon: React.ReactNode; tone: string; ring: string }> = {
  fila:        { label: "Fila",        icon: <Users className="h-4 w-4" />,       tone: "text-emerald-700 bg-emerald-500/10",   ring: "ring-emerald-500/30" },
  em_entrega:  { label: "Em entrega",  icon: <Package className="h-4 w-4" />,     tone: "text-sky-700 bg-sky-500/10",           ring: "ring-sky-500/30" },
  retornando:  { label: "Retornando",  icon: <RotateCcw className="h-4 w-4" />,   tone: "text-amber-700 bg-amber-400/10",       ring: "ring-amber-400/30" },
  pausa:       { label: "Pausa",       icon: <PauseCircle className="h-4 w-4" />, tone: "text-orange-700 bg-orange-500/10",     ring: "ring-orange-500/30" },
  offline:     { label: "Offline",     icon: <WifiOff className="h-4 w-4" />,     tone: "text-muted-foreground bg-muted",        ring: "ring-border" },
};

const GROUP_ORDER: CentralGroup[] = ["fila", "em_entrega", "retornando", "pausa", "offline"];

function CentralPage() {
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const fetch = useServerFn(getOperationsCentral);

  const queryKey = ["operations-central", restaurant.id] as const;
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetch({ data: { restaurantId: restaurant.id } }),
    enabled: !!restaurant.id,
    refetchInterval: 15000,
  });

  // Realtime: qualquer mudança em fila, atribuições ou motoboys re-carrega.
  useEffect(() => {
    if (!restaurant.id) return;
    const invalidate = () => qc.invalidateQueries({ queryKey });
    const ch = supabase
      .channel(`central-${restaurant.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "delivery_queue", filter: `restaurant_id=eq.${restaurant.id}` },
        invalidate)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "delivery_assignments", filter: `restaurant_id=eq.${restaurant.id}` },
        invalidate)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "delivery_drivers", filter: `restaurant_id=eq.${restaurant.id}` },
        invalidate)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurant.id, qc]);

  const drivers = data?.drivers ?? [];
  const metrics = data?.metrics;
  const grouped = useMemo(() => {
    const map: Record<CentralGroup, CentralDriver[]> = {
      fila: [], em_entrega: [], retornando: [], pausa: [], offline: [],
    };
    for (const d of drivers) map[d.group].push(d);
    return map;
  }, [drivers]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Central Operacional</h1>
          <p className="text-sm text-muted-foreground">Atualização em tempo real do time de entregas.</p>
        </div>
        <Badge variant="outline" className="gap-1 text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Ao vivo
        </Badge>
      </header>

      <MetricsRow metrics={metrics} loading={isLoading} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GROUP_ORDER.map((g) => (
          <GroupColumn key={g} group={g} drivers={grouped[g]} />
        ))}
      </div>
    </div>
  );
}

function MetricsRow({ metrics, loading }: { metrics: CentralMetrics | undefined; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <MetricCard
        icon={<Clock className="h-4 w-4" />} label="Tempo médio"
        value={metrics?.avgTotalMinutes != null ? `${metrics.avgTotalMinutes} min` : "—"}
        hint="Última 24h"
      />
      <MetricCard
        icon={<Users className="h-4 w-4" />} label="Fila"
        value={loading ? "…" : String(metrics?.queueLength ?? 0)}
        hint="Aguardando"
      />
      <MetricCard
        icon={<RotateCcw className="h-4 w-4" />} label="Tempo de retorno"
        value={metrics?.avgReturnMinutes != null ? `${metrics.avgReturnMinutes} min` : "—"}
        hint="Média entre entregas"
      />
      <MetricCard
        icon={<Activity className="h-4 w-4" />} label="Ativos"
        value={loading ? "…" : String((metrics?.delivering ?? 0) + (metrics?.returning ?? 0) + (metrics?.queueLength ?? 0))}
        hint={`${metrics?.total ?? 0} no total`}
      />
    </div>
  );
}

function MetricCard(props: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card className="rounded-2xl border-none p-4 shadow-sm">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="flex items-center gap-1 text-xs font-medium">{props.icon} {props.label}</span>
      </div>
      <p className="mt-1 font-display text-2xl font-extrabold">{props.value}</p>
      <p className="text-[11px] text-muted-foreground">{props.hint}</p>
    </Card>
  );
}

function GroupColumn({ group, drivers }: { group: CentralGroup; drivers: CentralDriver[] }) {
  const m = GROUP_META[group];
  return (
    <Card className="flex flex-col rounded-2xl border-none p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1", m.tone, m.ring)}>
          {m.icon} {m.label}
        </div>
        <span className="text-xs text-muted-foreground">{drivers.length}</span>
      </div>
      {drivers.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
          Ninguém aqui agora.
        </p>
      ) : (
        <ul className="space-y-2">
          {drivers.map((d) => <DriverRow key={d.id} d={d} />)}
        </ul>
      )}
    </Card>
  );
}

function DriverRow({ d }: { d: CentralDriver }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/50 p-2">
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
        {d.photo_url ? (
          <img src={d.photo_url} alt={d.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
            {d.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{d.name}</p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Bike className="h-3 w-3" />
          {d.vehicle_plate ?? d.vehicle_type}
          {d.group === "em_entrega" && d.active_order_number != null && (
            <span className="ml-1">• #{d.active_order_number}{d.active_customer ? ` · ${d.active_customer}` : ""}</span>
          )}
        </p>
      </div>
      {d.group === "fila" && d.queue_position != null && (
        <Badge variant="secondary">#{d.queue_position}</Badge>
      )}
      {d.group === "em_entrega" && d.active_since && (
        <Badge variant="outline">{minutesSince(d.active_since)}min</Badge>
      )}
    </li>
  );
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}
