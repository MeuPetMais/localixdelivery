import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bike, Search, Send, Loader2, MapPin, Timer, Users, PackageCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { supabase } from "@/integrations/supabase/client";
import { listDrivers } from "@/lib/delivery-drivers.functions";
import { queueList } from "@/lib/delivery-queue.functions";
import {
  listAssignments, assignDelivery, collectDelivery, departDelivery, deliverDelivery,
  cancelDelivery, listAutoAssignmentAudit,
} from "@/lib/delivery-assignment.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/entregas")({
  head: () => ({ meta: [
    { title: "Central de Entregas — Localix" },
    { name: "description", content: "Painel operacional de entregas em tempo real." },
  ] }),
  component: EntregasPage,
});

type Order = {
  id: string; order_number: number | null; customer_name: string;
  address: string | null; total: number; status: string; created_at: string;
};
type Driver = {
  id: string; name: string; online: boolean;
  status: "ativo" | "inativo" | "afastado";
};
type QueueEntry = {
  id: string; driver_id: string; position: number;
  status: "AGUARDANDO" | "EM_ENTREGA" | "RETORNANDO" | "INATIVO";
  entered_at: string;
};
type Assignment = {
  id: string; order_id: string; driver_id: string; status: string;
  assigned_at: string | null; distance_km: number | null;
  estimated_minutes: number | null;
};
type AssignmentIssue = {
  order_id: string | null;
  reason: string;
  created_at: string;
};

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function EntregasPage() {
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const rid = restaurant?.id;

  const ordersQ = useQuery({
    queryKey: ["ops-entregas-orders", rid],
    enabled: !!rid,
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, address, total, status, created_at")
        .eq("restaurant_id", rid!)
        .in("status", ["pronto", "saiu_para_entrega", "entregue"])
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const driversFn = useServerFn(listDrivers);
  const driversQ = useQuery({
    queryKey: ["ops-entregas-drivers", rid],
    enabled: !!rid,
    queryFn: async (): Promise<Driver[]> => {
      const rows = await driversFn({ data: { restaurantId: rid! } });
      return (rows ?? []) as Driver[];
    },
  });

  const queueFn = useServerFn(queueList);
  const queueQ = useQuery({
    queryKey: ["ops-entregas-queue", rid],
    enabled: !!rid,
    queryFn: async (): Promise<QueueEntry[]> => {
      const rows = await queueFn({ data: { restaurantId: rid! } });
      return (rows ?? []) as QueueEntry[];
    },
  });

  const assignFn = useServerFn(listAssignments);
  const assignQ = useQuery({
    queryKey: ["ops-entregas-assignments", rid],
    enabled: !!rid,
    queryFn: async (): Promise<Assignment[]> => {
      const rows = await assignFn({ data: { restaurantId: rid! } });
      return (rows ?? []) as Assignment[];
    },
  });

  const auditFn = useServerFn(listAutoAssignmentAudit);
  const auditQ = useQuery({
    queryKey: ["ops-entregas-auto-audit", rid],
    enabled: !!rid,
    queryFn: async (): Promise<AssignmentIssue[]> => {
      const rows = await auditFn({ data: { restaurantId: rid! } });
      return (rows ?? []) as AssignmentIssue[];
    },
  });

  // Realtime — invalida caches ao mudar dados
  useEffect(() => {
    if (!rid) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["ops-entregas-orders", rid] });
      qc.invalidateQueries({ queryKey: ["ops-entregas-queue", rid] });
      qc.invalidateQueries({ queryKey: ["ops-entregas-assignments", rid] });
      qc.invalidateQueries({ queryKey: ["ops-entregas-drivers", rid] });
      qc.invalidateQueries({ queryKey: ["ops-entregas-auto-audit", rid] });
    };
    const ch = supabase
      .channel(`ops-entregas-${rid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_assignments", filter: `restaurant_id=eq.${rid}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_queue", filter: `restaurant_id=eq.${rid}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_drivers", filter: `restaurant_id=eq.${rid}` }, invalidate)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [rid, qc]);

  // Tick a cada 30s para tempos relativos
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const orders = ordersQ.data ?? [];
  const drivers = driversQ.data ?? [];
  const queue = queueQ.data ?? [];
  const assignments = assignQ.data ?? [];
  const auditRows = auditQ.data ?? [];

  const driverById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const latestIssueByOrder = useMemo(() => {
    const map = new Map<string, AssignmentIssue>();
    for (const row of auditRows) {
      if (!row.order_id || map.has(row.order_id)) continue;
      map.set(row.order_id, row);
    }
    return map;
  }, [auditRows]);

  const inFlight = assignments.filter((a) => ["ATRIBUIDO", "COLETANDO", "EM_ROTA"].includes(a.status));
  const assignedOrderIds = new Set(inFlight.map((a) => a.order_id));
  const readyOrders = orders.filter((o) => o.status === "pronto" && !assignedOrderIds.has(o.id));
  const delivered = assignments.filter((a) => a.status === "ENTREGUE");
  const availableQueue = queue
    .filter((q) => q.status === "AGUARDANDO")
    .sort((a, b) => a.position - b.position);
  const driversOnline = drivers.filter((d) => d.online && d.status === "ativo").length;

  const avgMin = useMemo(() => {
    const done = delivered.slice(0, 20);
    if (done.length === 0) return 0;
    const total = done.reduce((s, a) => s + (a.estimated_minutes ?? 0), 0);
    return Math.round(total / done.length);
  }, [delivered]);

  // Filtros
  const [filter, setFilter] = useState<"todos" | "prontos" | "entrega" | "concluidos">("todos");
  const [search, setSearch] = useState("");
  const matchesSearch = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());

  const filteredReady = readyOrders.filter((o) =>
    matchesSearch(`${o.order_number ?? ""} ${o.customer_name} ${o.address ?? ""}`),
  );
  const filteredInFlight = inFlight.filter((a) => {
    const o = orderById.get(a.order_id);
    const d = driverById.get(a.driver_id);
    return matchesSearch(`${o?.order_number ?? ""} ${o?.customer_name ?? ""} ${d?.name ?? ""}`);
  });

  // Dispatch modal
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  const [pickDriverId, setPickDriverId] = useState<string | null>(null);
  const [choosingOther, setChoosingOther] = useState(false);

  const invalidateDeliveryQueries = () => {
    qc.invalidateQueries({ queryKey: ["ops-entregas-assignments", rid] });
    qc.invalidateQueries({ queryKey: ["ops-entregas-queue", rid] });
    qc.invalidateQueries({ queryKey: ["ops-entregas-orders", rid] });
    qc.invalidateQueries({ queryKey: ["ops-entregas-auto-audit", rid] });
  };

  const assignMut = useMutation({
    mutationFn: async (input: { orderId: string; driverId: string }) => {
      const runner = useServerFnRef.current;
      return runner({ data: input });
    },
    onSuccess: () => {
      toast.success("Entrega despachada");
      setDispatchOrder(null); setPickDriverId(null); setChoosingOther(false);
      invalidateDeliveryQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao despachar"),
  });
  const assignRunner = useServerFn(assignDelivery);
  const useServerFnRef = useMemoRef(assignRunner);

  const collectRunner = useServerFn(collectDelivery);
  const collectMut = useMutation({
    mutationFn: async (assignmentId: string) => collectRunner({ data: { assignmentId } }),
    onSuccess: () => {
      toast.success("Coleta confirmada");
      invalidateDeliveryQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao confirmar coleta"),
  });

  const departRunner = useServerFn(departDelivery);
  const departMut = useMutation({
    mutationFn: async (assignmentId: string) => departRunner({ data: { assignmentId } }),
    onSuccess: () => {
      toast.success("Rota iniciada");
      invalidateDeliveryQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar rota"),
  });

  const deliverRunner = useServerFn(deliverDelivery);
  const deliverMut = useMutation({
    mutationFn: async (assignmentId: string) => deliverRunner({ data: { assignmentId } }),
    onSuccess: () => {
      toast.success("Entrega concluída");
      invalidateDeliveryQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao concluir"),
  });

  const cancelRunner = useServerFn(cancelDelivery);
  const cancelMut = useMutation({
    mutationFn: async (assignmentId: string) => cancelRunner({ data: { assignmentId, reason: "Cancelamento administrativo" } }),
    onSuccess: () => {
      toast.success("Atribuicao cancelada");
      invalidateDeliveryQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar atribuicao"),
  });

  function openDispatch(order: Order) {
    const first = availableQueue[0];
    // Modo rápido: apenas um motoboy disponível → despacho imediato
    const availableDrivers = availableQueue
      .map((q) => driverById.get(q.driver_id))
      .filter((d): d is Driver => !!d && d.status === "ativo");
    if (availableDrivers.length === 1 && first) {
      assignMut.mutate({ orderId: order.id, driverId: first.driver_id });
      return;
    }
    setDispatchOrder(order);
    setPickDriverId(first?.driver_id ?? null);
    setChoosingOther(false);
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      {/* Header + indicadores */}
      <header className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <IndicatorCard icon={<PackageCheck className="h-4 w-4" />} label="Pedidos prontos" value={readyOrders.length} />
        <IndicatorCard icon={<Users className="h-4 w-4" />} label="Motoboys disponíveis" value={availableQueue.length} />
        <IndicatorCard icon={<Truck className="h-4 w-4" />} label="Em rota" value={inFlight.length} />
        <IndicatorCard icon={<Timer className="h-4 w-4" />} label="Tempo médio" value={`${avgMin}min`} />
      </header>

      {/* Filtros + busca */}
      <div className="flex flex-wrap items-center gap-2">
        {(["todos", "prontos", "entrega", "concluidos"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pedido, cliente, motoboy"
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        {/* Coluna 1 — Prontos */}
        {(filter === "todos" || filter === "prontos") && (
          <Card className="p-3">
            <ColumnHeader title="Pedidos Prontos" count={filteredReady.length} />
            <div className="mt-2 space-y-2">
              {filteredReady.length === 0 && <EmptyMsg text="Nenhum pedido pronto." />}
              {filteredReady.map((o) => (
                <div key={o.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">#{o.order_number ?? o.id.slice(0, 6)} • {o.customer_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <MapPin className="mr-1 inline h-3 w-3" />{o.address ?? "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {brl(o.total)} • {minutesSince(o.created_at)}min aguardando
                      </p>
                      {latestIssueByOrder.get(o.id)?.reason === "NO_DRIVER_AVAILABLE" && (
                        <p className="mt-1 text-xs text-amber-700">
                          Aguardando entregador: nenhum motoboy disponivel na fila.
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openDispatch(o)}
                      disabled={availableQueue.length === 0 || assignMut.isPending}
                    >
                      <Send className="mr-1 h-3 w-3" /> Despachar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Coluna 2 — Fila operacional */}
        {(filter === "todos" || filter === "prontos") && (
          <Card className="p-3">
            <ColumnHeader title="Fila Operacional" count={availableQueue.length} />
            <div className="mt-2 space-y-2">
              {queue.length === 0 && <EmptyMsg text="Fila vazia." />}
              {queue
                .filter((q) => q.status !== "INATIVO")
                .sort((a, b) => a.position - b.position)
                .map((q) => {
                  const d = driverById.get(q.driver_id);
                  const badge =
                    q.status === "AGUARDANDO" ? { icon: "🟢", label: "Disponível" }
                    : q.status === "EM_ENTREGA" ? { icon: "🚚", label: "Em entrega" }
                    : { icon: "↩", label: "Retornando" };
                  return (
                    <div key={q.id} className="flex items-center justify-between rounded-lg border bg-card p-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold">
                          {q.position}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{d?.name ?? "—"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {minutesSince(q.entered_at)}min • {badge.icon} {badge.label}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        )}

        {/* Coluna 3 — Em andamento */}
        {(filter === "todos" || filter === "entrega") && (
          <Card className="p-3">
            <ColumnHeader title="Em Andamento" count={filteredInFlight.length} />
            <div className="mt-2 space-y-2">
              {filteredInFlight.length === 0 && <EmptyMsg text="Sem entregas ativas." />}
              {filteredInFlight.map((a) => {
                const o = orderById.get(a.order_id);
                const d = driverById.get(a.driver_id);
                return (
                  <div key={a.id} className="rounded-lg border bg-card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          <Bike className="mr-1 inline h-3 w-3" />
                          {d?.name ?? "—"} • #{o?.order_number ?? a.order_id.slice(0, 6)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.assigned_at ? `${minutesSince(a.assigned_at)}min` : "—"}
                          {a.distance_km ? ` • ${a.distance_km.toFixed(1)}km` : ""}
                        </p>
                        <Badge variant="outline" className="mt-1 text-[10px]">{a.status}</Badge>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {a.status === "ATRIBUIDO" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={collectMut.isPending}
                            onClick={() => collectMut.mutate(a.id)}
                          >
                            Coletar
                          </Button>
                        )}
                        {a.status === "COLETANDO" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={departMut.isPending}
                            onClick={() => departMut.mutate(a.id)}
                          >
                            Iniciar rota
                          </Button>
                        )}
                        {a.status === "EM_ROTA" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={deliverMut.isPending}
                            onClick={() => deliverMut.mutate(a.id)}
                          >
                            Concluir
                          </Button>
                        )}
                        {o && availableQueue.length > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={assignMut.isPending}
                            onClick={() => openDispatch(o)}
                          >
                            Redistribuir
                          </Button>
                        )}
                        {a.status !== "EM_ROTA" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={cancelMut.isPending}
                            onClick={() => cancelMut.mutate(a.id)}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Coluna 4 — Resumo */}
        {(filter === "todos" || filter === "concluidos") && (
          <Card className="p-3">
            <ColumnHeader title="Resumo de Hoje" count={delivered.length} />
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <Stat label="Entregues" value={delivered.length} />
              <Stat label="Tempo médio" value={`${avgMin}min`} />
              <Stat label="Motoboys online" value={driversOnline} />
              <Stat label="Na fila" value={availableQueue.length} />
            </div>
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Últimas entregas</p>
              <div className="space-y-1">
                {delivered.slice(0, 6).map((a) => {
                  const o = orderById.get(a.order_id);
                  const d = driverById.get(a.driver_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="truncate">#{o?.order_number ?? a.order_id.slice(0, 6)} • {d?.name ?? "—"}</span>
                      <span className="text-muted-foreground">{a.estimated_minutes ?? "—"}min</span>
                    </div>
                  );
                })}
                {delivered.length === 0 && <EmptyMsg text="Ainda sem entregas." />}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Dispatch Modal */}
      <Dialog open={!!dispatchOrder} onOpenChange={(o) => { if (!o) { setDispatchOrder(null); setChoosingOther(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Despachar entrega</DialogTitle>
          </DialogHeader>
          {dispatchOrder && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold">#{dispatchOrder.order_number ?? dispatchOrder.id.slice(0, 6)} • {dispatchOrder.customer_name}</p>
                <p className="text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{dispatchOrder.address ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Total: {brl(dispatchOrder.total)}</p>
              </div>

              {!choosingOther ? (
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Sugestão automática</p>
                  <p className="font-semibold">
                    {driverById.get(pickDriverId ?? "")?.name ?? "Nenhum motoboy disponível"}
                  </p>
                </div>
              ) : (
                <div className="max-h-52 space-y-1 overflow-auto">
                  {availableQueue.length === 0 && <EmptyMsg text="Nenhum motoboy disponível." />}
                  {availableQueue.map((q) => {
                    const d = driverById.get(q.driver_id);
                    if (!d || d.status !== "ativo") return null;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setPickDriverId(q.driver_id)}
                        className={
                          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm " +
                          (pickDriverId === q.driver_id ? "border-primary bg-primary/10" : "hover:bg-muted")
                        }
                      >
                        <span className="truncate">#{q.position} • {d.name}</span>
                        <span className="text-xs text-muted-foreground">🟢</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setChoosingOther((v) => !v)}>
              {choosingOther ? "Voltar" : "Escolher outro"}
            </Button>
            <Button
              disabled={!pickDriverId || assignMut.isPending}
              onClick={() => dispatchOrder && pickDriverId && assignMut.mutate({ orderId: dispatchOrder.id, driverId: pickDriverId })}
            >
              {assignMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -- helpers de UI --
function IndicatorCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </Card>
  );
}
function ColumnHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      <Badge variant="secondary">{count}</Badge>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}
function EmptyMsg({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">{text}</p>;
}

// Pequeno helper para manter uma ref estável de um server function runner
function useMemoRef<T>(value: T) {
  const ref = useMemoRefStore(value);
  return ref;
}
function useMemoRefStore<T>(value: T): { current: T } {
  const boxed = useMemo(() => ({ current: value }), []); // eslint-disable-line react-hooks/exhaustive-deps
  boxed.current = value;
  return boxed;
}
