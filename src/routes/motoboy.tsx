import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight, Award, Bike, CheckCircle2, Circle, Clock, Home, LineChart,
  LogOut, MapPin, Package, PlayCircle, Sparkles, Target, Trophy,
  TrendingDown, TrendingUp, User, Wallet, History as HistoryIcon,
  ChevronRight, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  getDriverDashboard, enterQueue, leaveQueue, finishReturnToQueue, setDriverAvailability,
} from "@/lib/driver-dashboard.functions";
import {
  collectDelivery, departDelivery, deliverDelivery,
} from "@/lib/delivery-assignment.functions";
import {
  BRL, DEFAULT_GOALS, delta, formatMinutes, loadGoals, pct, saveGoals,
  type DriverGoals,
} from "@/lib/driver-wallet";
import { registerDriverServiceWorker } from "@/lib/pwa-driver";
import { PwaInstallModal, PwaInstallButton } from "@/components/driver/PwaInstallModal";
import { DriverWalletTab } from "@/components/driver/DriverWalletTab";
import { DriverProfileTab } from "@/components/driver/DriverProfileTab";
import {
  DRIVER_OPERATIONAL_STATUS_LABEL,
  getDriverOperationalStatus,
  type DriverOperationalStatus,
} from "@/lib/driver-operational-status";
import { useDriverLocationTracking } from "@/lib/tracking/location/use-driver-location-tracking";

export const Route = createFileRoute("/motoboy")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Carteira do Motoboy — Localix" },
    { name: "description", content: "Ganhos, meta diária e entrega atual." },
  ] }),
  component: DriverWallet,
});

type Tab = "home" | "ganhos" | "historico" | "estatisticas" | "ranking" | "perfil";
type Dash = NonNullable<Awaited<ReturnType<typeof getDriverDashboard>>>;

function DriverWallet() {
  const qc = useQueryClient();
  const [session, setSession] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [goalsOpen, setGoalsOpen] = useState(false);

  const fetchDash = useServerFn(getDriverDashboard);
  const enter = useServerFn(enterQueue);
  const leave = useServerFn(leaveQueue);
  const finishReturn = useServerFn(finishReturnToQueue);
  const availability = useServerFn(setDriverAvailability);
  const doCollect = useServerFn(collectDelivery);
  const doDepart = useServerFn(departDelivery);
  const doDeliver = useServerFn(deliverDelivery);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === true) void registerDriverServiceWorker();
  }, [session]);

  const dashQ = useQuery({
    queryKey: ["driver-wallet"],
    queryFn: () => fetchDash({}),
    enabled: session === true,
    refetchInterval: 30000,
  });

  const dash = dashQ.data;
  const driver = dash?.driver;
  const restaurantId = driver?.restaurant_id ?? null;
  const operationalStatus = (dash as any)?.operationalStatus as DriverOperationalStatus | undefined;

  const [goals, setGoals] = useState<DriverGoals>(DEFAULT_GOALS);
  useEffect(() => {
    if (driver?.id) setGoals(loadGoals(driver.id));
  }, [driver?.id]);

  useEffect(() => {
    if (!restaurantId || !driver?.id) return;
    const ch = supabase
      .channel(`driver-wallet-${driver.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "delivery_queue", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["driver-wallet"] }))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "delivery_assignments", filter: `driver_id=eq.${driver.id}` },
        () => qc.invalidateQueries({ queryKey: ["driver-wallet"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, driver?.id, qc]);

  const locationCtx = useMemo(() => {
    if (!driver?.id || !restaurantId) return null;
    return {
      driverId: driver.id,
      restaurantId,
      assignmentId: dash?.active?.assignment?.id ?? null,
      online: !!driver.online,
      paused: operationalStatus === "pausa",
      delivering: !!dash?.active,
    };
  }, [driver?.id, driver?.online, restaurantId, dash?.active, operationalStatus]);
  const locationTracking = useDriverLocationTracking(locationCtx);

  const enterMut = useMutation({
    mutationFn: () => enter({}),
    onSuccess: () => { toast.success("Você entrou na fila"); qc.invalidateQueries({ queryKey: ["driver-wallet"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const leaveMut = useMutation({
    mutationFn: () => leave({}),
    onSuccess: () => { toast.success("Você saiu da fila"); qc.invalidateQueries({ queryKey: ["driver-wallet"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const finishReturnMut = useMutation({
    mutationFn: () => finishReturn({}),
    onSuccess: () => { toast.success("Retorno concluído — você voltou ao fim da fila"); qc.invalidateQueries({ queryKey: ["driver-wallet"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  // RC6.6 — "Retirar pedido" = coletar + partir (tracking iniciado) em uma ação só.
  const availabilityMut = useMutation({
    mutationFn: (online: boolean) => availability({ data: { online } }),
    onSuccess: (result) => {
      if (result?.online && result?.in_queue) {
        toast.success("VocÃª entrou na fila");
      } else if (result?.online) {
        toast.success("VocÃª ficou online");
      } else {
        toast.success("VocÃª ficou offline");
      }
      qc.invalidateQueries({ queryKey: ["driver-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pickupMut = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      if (input.status === "ATRIBUIDO") {
        await doCollect({ data: { assignmentId: input.id } });
      }
      await doDepart({ data: { assignmentId: input.id } });
    },
    onSuccess: () => {
      toast.success("Pedido retirado — em entrega 🚴");
      qc.invalidateQueries({ queryKey: ["driver-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deliverMut = useMutation({
    mutationFn: (id: string) => doDeliver({ data: { assignmentId: id } }),
    onSuccess: () => {
      toast.success("Entrega concluída — retorne ao restaurante");
      qc.invalidateQueries({ queryKey: ["driver-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleOnline = async () => {
    if (!driver) return;
    availabilityMut.mutate(!driver.online);
  };

  if (session === null || dashQ.isLoading) return <ScreenSkeleton />;
  if (!session) return <LoginPrompt />;
  if (!dash || !driver) return <UnauthorizedPrompt />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-28">
      <PwaInstallModal auto />
      <div className="mx-auto max-w-md px-4 pt-6">

        <TopBar
          name={driver.name}
          photo={driver.photo_url}
          online={!!driver.online}
          onToggle={toggleOnline}
          busy={availabilityMut.isPending}
        />

        <LocationNotice status={locationTracking.status} online={!!driver.online} />

        {tab === "home" && (
          <HomeTab
            dash={dash}
            goals={goals}
            onOpenGoals={() => setGoalsOpen(true)}
            onEnter={() => enterMut.mutate()}
            onLeave={() => leaveMut.mutate()}
            onFinishReturn={() => finishReturnMut.mutate()}
            onPickup={(id, status) => pickupMut.mutate({ id, status })}
            onDeliver={(id) => deliverMut.mutate(id)}
            busy={pickupMut.isPending || deliverMut.isPending || enterMut.isPending || leaveMut.isPending || finishReturnMut.isPending || availabilityMut.isPending}
          />
        )}
        {tab === "ganhos" && <DriverWalletTab earnings={dash.earnings as any} history={dash.history as any} />}
        {tab === "historico" && <HistoryTab dash={dash} />}
        {tab === "estatisticas" && <StatsTab dash={dash} />}
        {tab === "ranking" && <RankingTab dash={dash} />}
        {tab === "perfil" && <DriverProfileTab driver={dash.driver as any} />}
      </div>

      {goalsOpen && driver && (
        <GoalsSheet
          initial={goals}
          onClose={() => setGoalsOpen(false)}
          onSave={(g) => {
            saveGoals(driver.id, g);
            setGoals(g);
            setGoalsOpen(false);
            toast.success("Meta salva");
          }}
        />
      )}

      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
}

/* ---------- Top ---------- */

function TopBar(props: {
  name: string; photo: string | null; online: boolean; onToggle: () => void; busy?: boolean;
}) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-background">
        {props.photo ? (
          <img src={props.photo} alt={props.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
            {props.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <Circle className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${props.online ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/40 text-muted-foreground/40"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">Olá,</p>
        <p className="truncate font-display text-lg font-extrabold leading-tight">{props.name.split(" ")[0]}</p>
      </div>
      <Button size="sm" variant={props.online ? "outline" : "default"} className="rounded-full" onClick={props.onToggle} disabled={props.busy}>
        {props.online ? "Online" : "Ficar online"}
      </Button>
    </div>
  );
}

/* ---------- Home (RC6.5) ---------- */

export function greetingFor(date = new Date()): "Bom dia" | "Boa tarde" | "Boa noite" {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export type DriverPresenceStatus = DriverOperationalStatus;

export function derivePresenceStatus(input: {
  online: boolean;
  queueStatus: string;
  hasActive: boolean;
}): DriverPresenceStatus {
  return getDriverOperationalStatus({
    online: input.online,
    queueStatus: input.queueStatus,
    hasActiveAssignment: input.hasActive,
  });
}

function LocationNotice(props: { status: "idle" | "tracking" | "permission_denied" | "unsupported"; online: boolean }) {
  if (!props.online) return null;
  if (props.status === "permission_denied") {
    return (
      <Card className="mb-4 rounded-2xl border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
        Permissao de localizacao negada. Ative a localizacao do navegador para atualizar sua posicao operacional.
      </Card>
    );
  }
  if (props.status === "unsupported") {
    return (
      <Card className="mb-4 rounded-2xl border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
        Este navegador nao oferece localizacao em tempo real. O restante do app continua funcionando.
      </Card>
    );
  }
  return (
    <Card className="mb-4 rounded-2xl border-none bg-muted/50 p-3 text-xs text-muted-foreground">
      A localizacao e usada durante sua disponibilidade e entregas para organizacao da operacao do restaurante.
    </Card>
  );
}

function StatusPill(props: { status: DriverPresenceStatus }) {
  const map: Record<DriverPresenceStatus, { label: string; dot: string; bg: string; fg: string }> = {
    offline: { label: DRIVER_OPERATIONAL_STATUS_LABEL.offline, dot: "bg-muted-foreground", bg: "bg-muted", fg: "text-muted-foreground" },
    disponivel: { label: DRIVER_OPERATIONAL_STATUS_LABEL.disponivel, dot: "bg-emerald-500", bg: "bg-emerald-500/10", fg: "text-emerald-700" },
    na_fila: { label: DRIVER_OPERATIONAL_STATUS_LABEL.na_fila, dot: "bg-blue-500", bg: "bg-blue-500/10", fg: "text-blue-700" },
    em_entrega: { label: DRIVER_OPERATIONAL_STATUS_LABEL.em_entrega, dot: "bg-amber-500", bg: "bg-amber-500/10", fg: "text-amber-700" },
    retornando: { label: DRIVER_OPERATIONAL_STATUS_LABEL.retornando, dot: "bg-sky-500", bg: "bg-sky-500/10", fg: "text-sky-700" },
    pausa: { label: DRIVER_OPERATIONAL_STATUS_LABEL.pausa, dot: "bg-orange-500", bg: "bg-orange-500/10", fg: "text-orange-700" },
  };
  const m = map[props.status];
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${m.bg} ${m.fg}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${m.dot}`} />
      {m.label}
    </div>
  );
}

function HomeTab(props: {
  dash: Dash;
  goals: DriverGoals;
  onOpenGoals: () => void;
  onEnter: () => void;
  onLeave: () => void;
  onFinishReturn: () => void;
  onPickup: (id: string, status: string) => void;
  onDeliver: (id: string) => void;
  busy?: boolean;
}) {
  const { dash } = props;
  const q = dash.queue;
  const driver = dash.driver;
  const restaurantName = (dash as any).restaurant?.name as string | undefined;
  const firstName = driver.name.split(" ")[0];
  const hasActive = !!dash.active;
  const presence = ((dash as any).operationalStatus as DriverPresenceStatus | undefined)
    ?? derivePresenceStatus({
      online: !!driver.online,
      queueStatus: q.status,
      hasActive,
    });
  const waitMin = q.waitingSince
    ? Math.max(0, Math.round((Date.now() - new Date(q.waitingSince).getTime()) / 60000))
    : 0;
  const waitLabel = `${String(Math.floor(waitMin / 60)).padStart(2, "0")}:${String(waitMin % 60).padStart(2, "0")}`;
  const nextMin = (q as any).nextDepartureMin as number | null | undefined;
  const avgMin = Math.round(dash.stats.avgAssignToDelivered || 0);
  const canOperate = driver.status === "ativo";
  const isReturning = presence === "retornando";
  const showQueueRecovery = driver.online && !q.inQueue && !isReturning && !hasActive;
  const nextDriverName = (q as any).nextDriverName as string | null | undefined;
  const estimatedWaitMinutes = (q as any).estimatedWaitMinutes as number | null | undefined;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-500">
      {/* Header — saudação + restaurante + status */}
      <div className="rounded-3xl bg-card p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{greetingFor()},</p>
        <p className="mt-1 font-display text-2xl font-extrabold leading-tight">{firstName}</p>
        {restaurantName && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{restaurantName}</p>
        )}
        <div className="mt-3">
          <StatusPill status={presence} />
        </div>
      </div>

      {/* Card — Fila */}
      <Card className="rounded-3xl border-none bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Fila do restaurante
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Posição</p>
            <p className="font-display text-3xl font-extrabold">{q.position ? `#${q.position}` : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Aguardando</p>
            <p className="font-display text-3xl font-extrabold tabular-nums">{q.inQueue ? waitLabel : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Próx. saída</p>
            <p className="font-display text-3xl font-extrabold">
              {q.inQueue && nextMin ? `${nextMin}m` : "—"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {q.length} motoboy(s) aguardando
          {nextDriverName ? ` · Próximo: ${nextDriverName}` : ""}
          {estimatedWaitMinutes != null ? ` · Espera aprox.: ${estimatedWaitMinutes}min` : ""}
        </p>
      </Card>

      {/* Cards — KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="rounded-3xl border-none bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-md">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
            <Wallet className="h-3.5 w-3.5" /> Ganhos de hoje
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold">{BRL(dash.earnings.today)}</p>
        </Card>
        <Card className="rounded-3xl border-none bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Entregas hoje
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold">{dash.earnings.todayCount}</p>
        </Card>
        <Card className="rounded-3xl border-none bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Tempo médio
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold">
            {avgMin > 0 ? `${avgMin} min` : "—"}
          </p>
        </Card>
      </div>

      {/* Botão principal — Entrar/Sair da fila */}
      <div>
        {isReturning ? (
          <Button
            size="lg"
            className="h-14 w-full rounded-2xl text-base font-semibold"
            onClick={props.onFinishReturn}
            disabled={props.busy || !canOperate || !driver.online}
          >
            Cheguei ao restaurante <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : q.inQueue ? (
          <Button
            size="lg"
            variant="outline"
            className="h-14 w-full rounded-2xl text-base font-semibold"
            onClick={props.onLeave}
            disabled={props.busy}
          >
            Sair da fila
          </Button>
        ) : showQueueRecovery ? (
          <Button
            size="lg"
            variant="outline"
            className="h-14 w-full rounded-2xl text-base font-semibold"
            onClick={props.onEnter}
            disabled={props.busy || !canOperate}
          >
            Reentrar na fila <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <div className="rounded-2xl bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
            {hasActive ? "Entrega ativa vinculada." : "Fique online para entrar automaticamente na fila."}
          </div>
        )}
        {!driver.online && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Fique online para entrar na fila.
          </p>
        )}
        {driver.online && !q.inQueue && !isReturning && !hasActive && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Você ainda não entrou na fila deste restaurante.
          </p>
        )}
      </div>

      {/* Entrega ativa */}
      {dash.active && (
        <ActiveDeliveryCard
          active={dash.active}
          onPickup={props.onPickup}
          onDeliver={props.onDeliver}
          busy={props.busy}
        />
      )}
    </div>
  );
}


function ActiveDeliveryCard(props: {
  active: NonNullable<Dash["active"]>;
  onPickup: (id: string, status: string) => void;
  onDeliver: (id: string) => void;
  busy?: boolean;
}) {
  const a = props.active.assignment;
  const o = props.active.order as any;
  // RC6.6 — Fluxo simplificado: Novo pedido → Retirar → Em entrega → Entregue → Retornando (auto-fila)
  const isNew = a.status === "ATRIBUIDO";
  const inRoute = a.status === "EM_ROTA" || a.status === "COLETANDO";
  const deliveryEarn = 8 + 1.5 * (a.distance_km ?? 0);

  const mapsUrl = o?.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.address)}`
    : null;

  const badge = isNew
    ? { label: "🆕 Novo pedido", cls: "bg-primary/10 text-primary" }
    : inRoute
    ? { label: "Em entrega", cls: "bg-amber-500/10 text-amber-700" }
    : { label: "Entrega em andamento", cls: "bg-emerald-500/10 text-emerald-600" };

  return (
    <Card className="animate-in slide-in-from-bottom-2 overflow-hidden rounded-3xl border-none bg-card p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <Badge className={`rounded-full ${badge.cls} hover:${badge.cls}`}>{badge.label}</Badge>
        {o?.order_number && <span className="text-xs text-muted-foreground">Pedido #{o.order_number}</span>}
      </div>
      <p className="font-display text-xl font-extrabold">{o?.customer_name ?? "Cliente"}</p>
      {o?.address && (
        <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {o.address}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-muted/50 p-2">
          <p className="text-muted-foreground">Distância</p>
          <p className="font-semibold">{(a.distance_km ?? 0).toFixed(1)} km</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-2">
          <p className="text-muted-foreground">Valor da entrega</p>
          <p className="font-semibold text-emerald-600">{BRL(deliveryEarn)}</p>
        </div>
      </div>

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 py-2 text-sm font-semibold hover:bg-muted"
        >
          <MapPin className="h-4 w-4" /> Abrir no mapa
        </a>
      )}

      {isNew ? (
        <Button
          size="lg"
          className="mt-5 h-14 w-full rounded-2xl text-base font-semibold"
          onClick={() => props.onPickup(a.id, a.status)}
          disabled={props.busy}
        >
          <Package className="h-4 w-4" />
          <span className="ml-2">Retirar pedido</span>
          <ArrowRight className="ml-auto h-4 w-4" />
        </Button>
      ) : (
        <Button
          size="lg"
          className="mt-5 h-14 w-full rounded-2xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-600/90"
          onClick={() => props.onDeliver(a.id)}
          disabled={props.busy}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="ml-2">Pedido entregue</span>
          <ArrowRight className="ml-auto h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}

/* ---------- Ganhos ---------- */

function EarningsTab(props: { dash: Dash; goals: DriverGoals; onOpenGoals: () => void }) {
  const { dash, goals } = props;
  const e = dash.earnings;
  const rows: [string, number, number][] = [
    ["Hoje", e.today, e.todayCount],
    ["Semana", e.week, e.weekCount],
    ["Mês", e.month, e.monthCount],
    ["Ano", e.year, e.yearCount],
  ];
  return (
    <div className="animate-in fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-extrabold">Ganhos</h2>
        <button onClick={props.onOpenGoals} className="text-xs text-primary font-semibold">Ajustar metas</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {rows.map(([label, val, cnt]) => (
          <Card key={label} className="rounded-2xl border-none p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{BRL(val)}</p>
            <p className="text-[11px] text-muted-foreground">{cnt} entrega(s)</p>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-none p-4 shadow-sm">
        <p className="text-sm font-semibold">Média por entrega</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div><p className="text-muted-foreground">Hoje</p><p className="font-display text-xl font-extrabold">{BRL(e.ticketToday)}</p></div>
          <div><p className="text-muted-foreground">Mês</p><p className="font-display text-xl font-extrabold">{BRL(e.ticketMonth)}</p></div>
        </div>
      </Card>

      <Card className="rounded-2xl border-none p-4 shadow-sm">
        <p className="text-sm font-semibold">Recordes</p>
        <div className="mt-3 space-y-2 text-sm">
          <RecordLine label="Maior dia" v={e.bestDay.value} sub={`${e.bestDay.count} entregas`} when={e.bestDay.key} />
          <RecordLine label="Maior semana" v={e.bestWeek.value} sub={`${e.bestWeek.count} entregas`} when={e.bestWeek.key} />
          <RecordLine label="Maior mês" v={e.bestMonth.value} sub={`${e.bestMonth.count} entregas`} when={e.bestMonth.key} />
        </div>
      </Card>

      <Card className="rounded-2xl border-none p-4 shadow-sm">
        <p className="text-sm font-semibold">Progresso das metas</p>
        <GoalLine label="Diária" current={e.todayCount} goal={goals.daily} unit="entregas" />
        <GoalLine label="Semanal" current={e.weekCount} goal={goals.weekly} unit="entregas" />
        <GoalLine label="Mensal" current={e.monthCount} goal={goals.monthly} unit="entregas" />
      </Card>

      <AchievementsCard dash={dash} />
    </div>
  );
}

function RecordLine(props: { label: string; v: number; sub: string; when: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
      <div>
        <p className="text-xs text-muted-foreground">{props.label}</p>
        <p className="text-xs">{props.when || "—"}</p>
      </div>
      <div className="text-right">
        <p className="font-display text-lg font-extrabold">{BRL(props.v)}</p>
        <p className="text-[11px] text-muted-foreground">{props.sub}</p>
      </div>
    </div>
  );
}

function GoalLine(props: { label: string; current: number; goal: number; unit: string }) {
  const p = pct(props.current, props.goal);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{props.label}</span>
        <span className="text-muted-foreground">{props.current}/{props.goal} {props.unit}</span>
      </div>
      <Progress value={p} className="mt-1 h-1.5" />
    </div>
  );
}

/* ---------- Histórico ---------- */

function HistoryTab(props: { dash: Dash }) {
  const grouped = useMemo(() => {
    const m = new Map<string, Dash["history"]>();
    for (const h of props.dash.history) {
      const ts = h.delivered_at ?? h.created_at;
      const d = new Date(ts!);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const yst = new Date(today); yst.setDate(today.getDate() - 1);
      let key: string;
      if (d >= today) key = "Hoje";
      else if (d >= yst) key = "Ontem";
      else key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      const arr = m.get(key) ?? [];
      arr.push(h);
      m.set(key, arr);
    }
    return [...m.entries()];
  }, [props.dash.history]);

  return (
    <div className="animate-in fade-in space-y-4">
      <h2 className="font-display text-2xl font-extrabold">Extrato</h2>
      {grouped.length === 0 && (
        <Card className="rounded-2xl border-none p-8 text-center text-sm text-muted-foreground">
          Nenhuma entrega ainda.
        </Card>
      )}
      {grouped.map(([day, items]) => (
        <div key={day}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</p>
          <Card className="divide-y divide-border/40 rounded-2xl border-none shadow-sm">
            {items.map((h: any) => (
              <div key={h.id} className="flex items-center gap-3 p-4">
                <div className={`rounded-full p-2 ${h.status === "ENTREGUE" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
                  {h.status === "ENTREGUE" ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    Pedido {h.order?.order_number ? `#${h.order.order_number}` : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h.order?.customer_name ?? "—"} · {h.status === "ENTREGUE" ? "Entregue" : "Cancelada"}
                  </p>
                </div>
                <p className={`font-display text-sm font-extrabold ${h.status === "ENTREGUE" ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {h.status === "ENTREGUE" ? `+ ${BRL(h.earnings)}` : "—"}
                </p>
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

/* ---------- Estatísticas ---------- */

function StatsTab(props: { dash: Dash }) {
  const s = props.dash.stats;
  const e = props.dash.earnings;
  return (
    <div className="animate-in fade-in space-y-4">
      <h2 className="font-display text-2xl font-extrabold">Estatísticas</h2>
      <div className="grid grid-cols-3 gap-3">
        <StatMini label="Hoje" value={String(e.todayCount)} />
        <StatMini label="Semana" value={String(e.weekCount)} />
        <StatMini label="Mês" value={String(e.monthCount)} />
      </div>
      <Card className="rounded-2xl border-none p-4 shadow-sm">
        <p className="text-sm font-semibold">Tempos médios</p>
        <StatRow label="Atribuição → Entregue" value={formatMinutes(s.avgAssignToDelivered)} />
        <StatRow label="Coleta → Entregue" value={formatMinutes(s.avgPickupToDelivered)} />
        <StatRow label="Saída → Entregue" value={formatMinutes(s.avgDepartToDelivered)} />
      </Card>
      <Card className="rounded-2xl border-none p-4 shadow-sm">
        <p className="text-sm font-semibold">Distância percorrida</p>
        <StatRow label="Hoje" value={`${s.distanceToday.toFixed(1)} km`} />
        <StatRow label="Semana" value={`${s.distanceWeek.toFixed(1)} km`} />
        <StatRow label="Mês" value={`${s.distanceMonth.toFixed(1)} km`} />
      </Card>
      <Card className="rounded-2xl border-none p-4 shadow-sm">
        <p className="text-sm font-semibold">Sequência</p>
        <StatRow label="Dias seguidos batendo meta" value={`${s.streak} dia(s)`} />
        <StatRow label="Valor médio por entrega" value={BRL(e.ticketMonth)} />
      </Card>
    </div>
  );
}

function StatMini(props: { label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-none p-3 text-center shadow-sm">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{props.label}</p>
      <p className="font-display text-2xl font-extrabold">{props.value}</p>
    </Card>
  );
}
function StatRow(props: { label: string; value: string }) {
  return (
    <div className="mt-2 flex items-center justify-between border-b border-border/40 pb-2 last:border-0 text-sm">
      <span className="text-muted-foreground">{props.label}</span>
      <span className="font-semibold">{props.value}</span>
    </div>
  );
}

/* ---------- Ranking ---------- */

function RankingTab(props: { dash: Dash }) {
  const list = props.dash.ranking.list;
  const myId = props.dash.driver.id;
  return (
    <div className="animate-in fade-in space-y-4">
      <h2 className="font-display text-2xl font-extrabold">Ranking</h2>
      <p className="text-xs text-muted-foreground">Motoboys deste restaurante — hoje.</p>
      <Card className="divide-y divide-border/40 rounded-2xl border-none shadow-sm">
        {list.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Sem entregas hoje ainda.</div>
        )}
        {list.map((r, i) => {
          const me = r.id === myId;
          return (
            <div key={r.id} className={`flex items-center gap-3 p-4 ${me ? "bg-primary/5" : ""}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                {r.photo_url ? <img src={r.photo_url} alt={r.name} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold">{r.name}{me ? " (você)" : ""}</p>
                <p className="text-xs text-muted-foreground">{r.deliveries} entregas · {formatMinutes(r.avgMinutes)}</p>
              </div>
              <p className="font-display text-sm font-extrabold">{BRL(r.earnings)}</p>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ---------- Conquistas ---------- */

function AchievementsCard(props: { dash: Dash }) {
  return (
    <Card className="rounded-2xl border-none p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Conquistas</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {props.dash.achievements.map((a) => (
          <div key={a.id} className={`rounded-xl p-3 text-xs ${a.achieved ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"}`}>
            <Sparkles className={`h-3.5 w-3.5 ${a.achieved ? "" : "opacity-40"}`} />
            <p className="mt-1 font-semibold">{a.label}</p>
            <p className="text-[10px] opacity-80">{a.achieved ? "Desbloqueada" : "Bloqueada"}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Perfil movido para components/driver/DriverProfileTab.tsx (RC6.8) ---------- */

/* ---------- Goals sheet ---------- */

function GoalsSheet(props: { initial: DriverGoals; onClose: () => void; onSave: (g: DriverGoals) => void }) {
  const [daily, setDaily] = useState(String(props.initial.daily));
  const [weekly, setWeekly] = useState(String(props.initial.weekly));
  const [monthly, setMonthly] = useState(String(props.initial.monthly));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={props.onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-background p-6 shadow-2xl animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" />
        <h3 className="font-display text-xl font-extrabold">Configurar metas</h3>
        <p className="text-xs text-muted-foreground">Metas de entregas por período.</p>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Meta diária</Label>
            <Input type="number" min={1} value={daily} onChange={(e) => setDaily(e.target.value)} />
          </div>
          <div>
            <Label>Meta semanal</Label>
            <Input type="number" min={1} value={weekly} onChange={(e) => setWeekly(e.target.value)} />
          </div>
          <div>
            <Label>Meta mensal</Label>
            <Input type="number" min={1} value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-5 h-12 w-full rounded-2xl"
          onClick={() => props.onSave({
            daily: Math.max(1, Number(daily) || 1),
            weekly: Math.max(1, Number(weekly) || 1),
            monthly: Math.max(1, Number(monthly) || 1),
          })}
        >
          <Save className="mr-2 h-4 w-4" /> Salvar metas
        </Button>
      </div>
    </div>
  );
}

/* ---------- Bottom Nav ---------- */

function BottomNav(props: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "home", icon: <Home className="h-5 w-5" />, label: "Início" },
    { id: "ganhos", icon: <Wallet className="h-5 w-5" />, label: "Carteira" },
    { id: "historico", icon: <HistoryIcon className="h-5 w-5" />, label: "Extrato" },
    { id: "estatisticas", icon: <LineChart className="h-5 w-5" />, label: "Stats" },
    { id: "ranking", icon: <Trophy className="h-5 w-5" />, label: "Ranking" },
    { id: "perfil", icon: <User className="h-5 w-5" />, label: "Perfil" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-around px-1 py-2">
        {items.map((it) => {
          const active = props.tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => props.onChange(it.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1 transition-all ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <div className={`rounded-full p-1.5 transition-all ${active ? "bg-primary/10 scale-110" : ""}`}>{it.icon}</div>
              <span className={`text-[10px] font-semibold ${active ? "opacity-100" : "opacity-70"}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------- Empty states ---------- */

function ScreenSkeleton() {
  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <div className="h-12 animate-pulse rounded-2xl bg-muted" />
      <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      <div className="h-24 animate-pulse rounded-3xl bg-muted" />
    </div>
  );
}
function LoginPrompt() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-extrabold">Carteira do Motoboy</h1>
      <p className="text-sm text-muted-foreground">
        Acesse com seu CPF ou telefone cadastrado.
      </p>
      <Button asChild size="lg" className="rounded-2xl">
        <Link to="/entregador/entrar">Entrar como Entregador</Link>
      </Button>
      <p className="text-xs text-muted-foreground">
        Ainda não ativou?{" "}
        <Link to="/entregador/ativar" className="underline underline-offset-4">
          Ativar minha conta
        </Link>
      </p>
    </div>
  );
}
function UnauthorizedPrompt() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-extrabold">Acesso não autorizado</h1>
      <p className="text-sm text-muted-foreground">
        Sua conta não está vinculada a nenhum restaurante como motoboy.
      </p>
      <Button variant="outline" onClick={() => supabase.auth.signOut()} className="rounded-2xl">
        <LogOut className="mr-1 h-4 w-4" /> Sair
      </Button>
    </div>
  );
}

