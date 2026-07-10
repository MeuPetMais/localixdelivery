import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight, Bike, CheckCircle2, Circle, Clock, Home, LogOut, MapPin,
  Package, PlayCircle, Sparkles, Trophy, TrendingUp, Wallet, User,
  History as HistoryIcon, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { setMyPresence } from "@/lib/delivery-drivers.functions";
import {
  getDriverDashboard, enterQueue, leaveQueue,
} from "@/lib/driver-dashboard.functions";
import {
  collectDelivery, departDelivery, deliverDelivery,
} from "@/lib/delivery-assignment.functions";

export const Route = createFileRoute("/motoboy")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Carteira do Motoboy — Localix" },
    { name: "description", content: "Ganhos, meta diária e entrega atual." },
  ] }),
  component: DriverWallet,
});

type Tab = "home" | "fila" | "historico" | "perfil";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DriverWallet() {
  const qc = useQueryClient();
  const [session, setSession] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("home");

  const fetchDash = useServerFn(getDriverDashboard);
  const enter = useServerFn(enterQueue);
  const leave = useServerFn(leaveQueue);
  const presence = useServerFn(setMyPresence);
  const doCollect = useServerFn(collectDelivery);
  const doDepart = useServerFn(departDelivery);
  const doDeliver = useServerFn(deliverDelivery);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const dashQ = useQuery({
    queryKey: ["driver-wallet"],
    queryFn: () => fetchDash({}),
    enabled: session === true,
    refetchInterval: 20000,
  });

  const dash = dashQ.data;
  const driver = dash?.driver;
  const restaurantId = driver?.restaurant_id ?? null;

  // Realtime: fila e entregas
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

  // Heartbeat quando online
  useEffect(() => {
    if (!driver?.online) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const send = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => presence({ data: { online: true, lat: pos.coords.latitude, lng: pos.coords.longitude } }),
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      );
    };
    send();
    const t = setInterval(send, 30000);
    return () => clearInterval(t);
  }, [driver?.online, presence]);

  const enterMut = useMutation({
    mutationFn: () => enter({}),
    onSuccess: () => {
      toast.success("Você entrou na fila");
      qc.invalidateQueries({ queryKey: ["driver-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const leaveMut = useMutation({
    mutationFn: () => leave({}),
    onSuccess: () => {
      toast.success("Você saiu da fila");
      qc.invalidateQueries({ queryKey: ["driver-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const collectMut = useMutation({
    mutationFn: (id: string) => doCollect({ data: { assignmentId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver-wallet"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const departMut = useMutation({
    mutationFn: (id: string) => doDepart({ data: { assignmentId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver-wallet"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const deliverMut = useMutation({
    mutationFn: (id: string) => doDeliver({ data: { assignmentId: id } }),
    onSuccess: () => {
      toast.success("Entrega concluída — de volta à fila 🎉");
      qc.invalidateQueries({ queryKey: ["driver-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleOnline = async () => {
    if (!driver) return;
    if (!driver.online && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => presence({ data: { online: true, lat: pos.coords.latitude, lng: pos.coords.longitude } })
          .then(() => qc.invalidateQueries({ queryKey: ["driver-wallet"] })),
        () => presence({ data: { online: true } })
          .then(() => qc.invalidateQueries({ queryKey: ["driver-wallet"] })),
      );
    } else {
      await presence({ data: { online: !driver.online } });
      qc.invalidateQueries({ queryKey: ["driver-wallet"] });
    }
  };

  if (session === null || dashQ.isLoading) {
    return <ScreenSkeleton />;
  }
  if (!session) return <LoginPrompt />;
  if (!dash || !driver) return <UnauthorizedPrompt />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-28">
      <div className="mx-auto max-w-md px-4 pt-6">
        <TopBar
          name={driver.name}
          photo={driver.photo_url}
          online={!!driver.online}
          onToggle={toggleOnline}
        />

        {tab === "home" && (
          <HomeTab
            dash={dash}
            onCollect={(id) => collectMut.mutate(id)}
            onDepart={(id) => departMut.mutate(id)}
            onDeliver={(id) => deliverMut.mutate(id)}
            busy={collectMut.isPending || departMut.isPending || deliverMut.isPending}
          />
        )}
        {tab === "fila" && (
          <QueueTab
            dash={dash}
            onEnter={() => enterMut.mutate()}
            onLeave={() => leaveMut.mutate()}
            busy={enterMut.isPending || leaveMut.isPending}
          />
        )}
        {tab === "historico" && <HistoryTab dash={dash} />}
        {tab === "perfil" && <ProfileTab dash={dash} />}
      </div>

      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
}

/* ---------- Top ---------- */

function TopBar(props: {
  name: string; photo: string | null; online: boolean; onToggle: () => void;
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
        <p className="truncate font-display text-lg font-extrabold leading-tight">
          {props.name.split(" ")[0]}
        </p>
      </div>
      <Button
        size="sm"
        variant={props.online ? "outline" : "default"}
        className="rounded-full"
        onClick={props.onToggle}
      >
        {props.online ? "Online" : "Ficar online"}
      </Button>
    </div>
  );
}

/* ---------- Home ---------- */

function HomeTab(props: {
  dash: NonNullable<Awaited<ReturnType<typeof getDriverDashboard>>>;
  onCollect: (id: string) => void;
  onDepart: (id: string) => void;
  onDeliver: (id: string) => void;
  busy?: boolean;
}) {
  const { dash } = props;
  const pct = Math.min(100, Math.round((dash.earnings.todayCount / dash.earnings.dailyGoal) * 100));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-500">
      {/* Saldo */}
      <Card className="relative overflow-hidden rounded-3xl border-none bg-gradient-to-br from-primary via-primary to-primary/80 p-6 text-primary-foreground shadow-xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
            <Wallet className="h-3.5 w-3.5" />
            Ganhos de hoje
          </div>
          <p className="mt-2 font-display text-5xl font-extrabold tracking-tight">
            {BRL(dash.earnings.today)}
          </p>
          <div className="mt-4 flex items-center justify-between text-xs opacity-90">
            <span>{dash.earnings.todayCount} entrega(s) hoje</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Semana {BRL(dash.earnings.week)}
            </span>
          </div>
        </div>
      </Card>

      {/* Meta */}
      <Card className="rounded-3xl border-none bg-card/80 p-5 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Meta diária</p>
              <p className="text-xs text-muted-foreground">
                {dash.earnings.todayCount} de {dash.earnings.dailyGoal} entregas
              </p>
            </div>
          </div>
          <p className="font-display text-2xl font-extrabold">{pct}%</p>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
      </Card>

      {/* Entrega atual OU fila */}
      {dash.active ? (
        <ActiveDeliveryCard
          active={dash.active}
          onCollect={props.onCollect}
          onDepart={props.onDepart}
          onDeliver={props.onDeliver}
          busy={props.busy}
        />
      ) : (
        <QueueStatusCard queue={dash.queue} />
      )}

      {/* Cards menores */}
      <div className="grid grid-cols-2 gap-3">
        <MiniCard
          icon={<Trophy className="h-4 w-4" />}
          label="Ranking"
          value={dash.ranking.position ? `#${dash.ranking.position}` : "—"}
          hint={dash.ranking.total > 0 ? `de ${dash.ranking.total}` : "hoje"}
        />
        <MiniCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Conquistas"
          value={dash.earnings.todayCount >= dash.earnings.dailyGoal ? "🏆" : "—"}
          hint={dash.earnings.todayCount >= dash.earnings.dailyGoal ? "Meta batida!" : "Continue"}
        />
      </div>
    </div>
  );
}

function ActiveDeliveryCard(props: {
  active: NonNullable<NonNullable<Awaited<ReturnType<typeof getDriverDashboard>>>["active"]>;
  onCollect: (id: string) => void;
  onDepart: (id: string) => void;
  onDeliver: (id: string) => void;
  busy?: boolean;
}) {
  const a = props.active.assignment;
  const o = props.active.order as any;
  const steps = ["ATRIBUIDO", "COLETANDO", "EM_ROTA", "ENTREGUE"] as const;
  const idx = steps.indexOf(a.status as any);

  const nextAction = () => {
    if (a.status === "ATRIBUIDO") return { label: "Coletar pedido", icon: <Package className="h-4 w-4" />, fn: () => props.onCollect(a.id) };
    if (a.status === "COLETANDO") return { label: "Iniciar entrega", icon: <PlayCircle className="h-4 w-4" />, fn: () => props.onDepart(a.id) };
    if (a.status === "EM_ROTA") return { label: "Confirmar entrega", icon: <CheckCircle2 className="h-4 w-4" />, fn: () => props.onDeliver(a.id) };
    return null;
  };
  const act = nextAction();

  return (
    <Card className="animate-in slide-in-from-bottom-2 overflow-hidden rounded-3xl border-none bg-card p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <Badge className="rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">
          Entrega em andamento
        </Badge>
        {o?.order_number && (
          <span className="text-xs text-muted-foreground">#{o.order_number}</span>
        )}
      </div>
      <p className="font-display text-xl font-extrabold">{o?.customer_name ?? "Cliente"}</p>
      {o?.delivery_address && (
        <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {typeof o.delivery_address === "string" ? o.delivery_address : JSON.stringify(o.delivery_address)}
        </p>
      )}

      <div className="mt-4 grid grid-cols-4 gap-1">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all ${i <= idx ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>Atribuído</span><span>Coletado</span><span>Em rota</span><span>Entregue</span>
      </div>

      {act && (
        <Button
          size="lg"
          className="mt-5 h-14 w-full rounded-2xl text-base font-semibold"
          onClick={act.fn}
          disabled={props.busy}
        >
          {act.icon}
          <span className="ml-2">{act.label}</span>
          <ArrowRight className="ml-auto h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}

function QueueStatusCard(props: { queue: { position: number | null; length: number; inQueue: boolean } }) {
  return (
    <Card className="rounded-3xl border-none bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <Clock className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {props.queue.inQueue ? "Você está na fila" : "Fora da fila"}
          </p>
          <p className="text-xs text-muted-foreground">
            {props.queue.inQueue
              ? `Posição ${props.queue.position} de ${props.queue.length}`
              : "Entre na fila para receber entregas"}
          </p>
        </div>
      </div>
    </Card>
  );
}

function MiniCard(props: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card className="rounded-2xl border-none bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {props.icon} {props.label}
      </div>
      <p className="mt-1 font-display text-2xl font-extrabold leading-tight">{props.value}</p>
      <p className="text-xs text-muted-foreground">{props.hint}</p>
    </Card>
  );
}

/* ---------- Fila ---------- */

function QueueTab(props: {
  dash: NonNullable<Awaited<ReturnType<typeof getDriverDashboard>>>;
  onEnter: () => void; onLeave: () => void; busy?: boolean;
}) {
  const { queue, driver } = props.dash;
  const canOperate = driver.status === "ativo";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
      <Card className="rounded-3xl border-none bg-gradient-to-br from-primary/90 to-primary p-6 text-primary-foreground shadow-xl">
        <p className="text-xs uppercase tracking-wider opacity-80">Sua posição</p>
        <p className="mt-2 font-display text-6xl font-extrabold">
          {queue.position ? `#${queue.position}` : "—"}
        </p>
        <p className="mt-1 text-sm opacity-90">
          {queue.length} motoboy(s) na fila
        </p>
      </Card>

      {queue.inQueue ? (
        <Button
          variant="outline"
          size="lg"
          className="h-14 w-full rounded-2xl"
          onClick={props.onLeave}
          disabled={props.busy}
        >
          Sair da fila
        </Button>
      ) : (
        <Button
          size="lg"
          className="h-14 w-full rounded-2xl text-base font-semibold"
          onClick={props.onEnter}
          disabled={props.busy || !canOperate || !driver.online}
        >
          Entrar na fila <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}

      {!driver.online && (
        <p className="text-center text-xs text-muted-foreground">
          Fique online para entrar na fila.
        </p>
      )}
      {!canOperate && (
        <p className="text-center text-xs text-destructive">
          Cadastro {driver.status}. Fale com o restaurante.
        </p>
      )}
    </div>
  );
}

/* ---------- Histórico ---------- */

function HistoryTab(props: { dash: NonNullable<Awaited<ReturnType<typeof getDriverDashboard>>> }) {
  const history = props.dash.history;
  return (
    <div className="animate-in fade-in space-y-3">
      <h2 className="font-display text-xl font-extrabold">Histórico</h2>
      {history.length === 0 && (
        <Card className="rounded-2xl border-none p-8 text-center text-sm text-muted-foreground">
          Nenhuma entrega ainda.
        </Card>
      )}
      {history.map((h: any) => (
        <Card key={h.id} className="flex items-center gap-3 rounded-2xl border-none p-4 shadow-sm">
          <div className={`rounded-full p-2 ${h.status === "ENTREGUE" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
            {h.status === "ENTREGUE" ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold capitalize">
              {h.status === "ENTREGUE" ? "Entregue" : "Cancelada"}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(h.delivered_at ?? h.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          {h.status === "ENTREGUE" && (
            <p className="font-display text-sm font-extrabold text-emerald-600">
              +{BRL(8 + 1.5 * (h.distance_km ?? 0))}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ---------- Perfil ---------- */

function ProfileTab(props: { dash: NonNullable<Awaited<ReturnType<typeof getDriverDashboard>>> }) {
  const d = props.dash.driver;
  return (
    <div className="animate-in fade-in space-y-4">
      <Card className="flex flex-col items-center rounded-3xl border-none p-6 shadow-sm">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-muted">
          {d.photo_url ? (
            <img src={d.photo_url} alt={d.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
              {d.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <p className="mt-3 font-display text-xl font-extrabold">{d.name}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Bike className="h-3 w-3" /> {d.vehicle_type}{d.vehicle_plate ? ` • ${d.vehicle_plate}` : ""}
        </p>
        <Badge variant="outline" className="mt-2 capitalize">{d.status}</Badge>
      </Card>

      <Card className="rounded-2xl border-none p-4 text-sm shadow-sm">
        <p className="text-muted-foreground">Telefone</p>
        <p className="font-semibold">{d.phone ?? "—"}</p>
      </Card>
      <Card className="rounded-2xl border-none p-4 text-sm shadow-sm">
        <p className="text-muted-foreground">E-mail</p>
        <p className="font-semibold">{d.email ?? "—"}</p>
      </Card>

      <Button variant="outline" className="w-full rounded-2xl" onClick={() => supabase.auth.signOut()}>
        <LogOut className="mr-2 h-4 w-4" /> Sair
      </Button>
    </div>
  );
}

/* ---------- Bottom Nav ---------- */

function BottomNav(props: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "home", icon: <Home className="h-5 w-5" />, label: "Início" },
    { id: "fila", icon: <Clock className="h-5 w-5" />, label: "Fila" },
    { id: "historico", icon: <HistoryIcon className="h-5 w-5" />, label: "Histórico" },
    { id: "perfil", icon: <User className="h-5 w-5" />, label: "Perfil" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {items.map((it) => {
          const active = props.tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => props.onChange(it.id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-all ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <div className={`rounded-full p-1.5 transition-all ${active ? "bg-primary/10 scale-110" : ""}`}>
                {it.icon}
              </div>
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
        Entre com o e-mail cadastrado pelo restaurante.
      </p>
      <Button asChild size="lg" className="rounded-2xl">
        <Link to="/auth">Entrar</Link>
      </Button>
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
