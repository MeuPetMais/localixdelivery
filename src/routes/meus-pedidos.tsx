import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyOrders } from "@/lib/public-orders.functions";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/lib/format";
import {
  ArrowRight,
  ShoppingBag,
  RotateCw,
  Clock,
  CheckCircle2,
  Heart,
  Package,
  Utensils,
  Sparkles,
} from "lucide-react";
import { useCustomerNavigation } from "@/contexts/CustomerNavigationContext";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({ meta: [{ title: "Meus Pedidos — Localix" }] }),
  component: MyOrders,
});

type Order = {
  id: string;
  order_number: number | null;
  status: string;
  total: number;
  items: any;
  created_at: string;
  restaurant_id: string;
  estimated_delivery_time: number | null;
};
type RestaurantInfo = { id: string; name: string; slug: string; logo_url: string | null };

const ACTIVE_STATUSES = new Set([
  "aguardando_pagamento",
  "pago",
  "aceito",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
]);

function MyOrders() {
  const navigate = useNavigate();
  const fetchMyOrders = useServerFn(getMyOrders);
  const { user, loading: authLoading, isAuthenticated } = useCustomerAuth();
  const { currentRestaurantSlug, lastRestaurantSlug } = useCustomerNavigation();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, RestaurantInfo>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchMyOrders()
      .then((res) => {
        if (!active) return;
        setOrders((res.orders ?? []) as Order[]);
        const map: Record<string, RestaurantInfo> = {};
        for (const r of res.restaurants ?? []) map[r.id] = r as RestaurantInfo;
        setRestaurants(map);
      })
      .catch(() => active && setOrders([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, fetchMyOrders]);

  const { active, finished, stats } = useMemo(() => {
    const activeList = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
    const finishedList = orders.filter((o) => !ACTIVE_STATUSES.has(o.status));
    return {
      active: activeList[0] ?? null,
      finished: finishedList,
      stats: {
        total: orders.length,
        ongoing: activeList.length,
        done: orders.filter((o) => o.status === "entregue").length,
      },
    };
  }, [orders]);

  function goToRestaurant(slug?: string | null) {
    const target = slug ?? currentRestaurantSlug ?? lastRestaurantSlug;
    if (target) navigate({ to: "/$slug", params: { slug: target } });
  }

  function repeatOrder(o: Order) {
    const r = restaurants[o.restaurant_id];
    if (!r?.slug) return;
    const items = Array.isArray(o.items) ? o.items : [];
    try {
      sessionStorage.setItem(
        `repeat:${r.slug}`,
        JSON.stringify(
          items.map((it: any) => ({
            id: it.id,
            name: it.name,
            price: Number(it.price),
            qty: Number(it.qty),
          })),
        ),
      );
    } catch {}
    navigate({ to: "/$slug", params: { slug: r.slug } });
  }

  // Loading session — show skeleton, never the login screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background pb-24">
        <Header name={null} avatarUrl={null} />
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-3xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </main>
      </div>
    );
  }

  // Unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background pb-24">
        <Header name={null} avatarUrl={null} />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <Card className="rounded-3xl border-0 p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-primary/10">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <h2 className="font-display text-xl font-extrabold">Entre para ver seus pedidos</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Faça login para acompanhar seus pedidos, favoritos e histórico de compras.
            </p>
            <Button asChild className="mt-6 rounded-full" size="lg">
              <Link to="/entrar" search={{ redirect: currentRestaurantSlug || lastRestaurantSlug ? `/${currentRestaurantSlug ?? lastRestaurantSlug}` : "/cliente" }}>
                Entrar na minha conta
              </Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  const meta = (user?.user_metadata ?? {}) as Record<string, any>;
  const displayName =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Cliente";
  const avatarUrl =
    (meta.avatar_url as string | undefined) ?? (meta.picture as string | undefined) ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background pb-24">
      <Header name={user ? displayName : null} avatarUrl={avatarUrl} />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-5 md:px-6">
        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={<ShoppingBag className="h-5 w-5" />} label="Pedidos" value={loading ? "—" : stats.total} />
          <StatCard icon={<Clock className="h-5 w-5" />} label="Em andamento" value={loading ? "—" : stats.ongoing} tone="amber" />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Finalizados" value={loading ? "—" : stats.done} tone="emerald" />
          <StatCard icon={<Heart className="h-5 w-5" />} label="Favoritos" value="—" tone="rose" />
        </section>

        {/* Active order */}
        {loading ? (
          <Skeleton className="h-44 w-full rounded-3xl" />
        ) : active ? (
          <ActiveOrderCard
            order={active}
            restaurant={restaurants[active.restaurant_id]}
            onTrack={() => navigate({ to: "/pedido/$id", params: { id: active.id } })}
          />
        ) : null}

        {/* History */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">Histórico de pedidos</h2>
            {finished.length > 0 && (
              <span className="text-xs text-muted-foreground">{finished.length} pedidos</span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : finished.length === 0 && !active ? (
            <EmptyState onExplore={() => goToRestaurant()} />
          ) : (
            <div className="space-y-3">
              {finished.map((o) => (
                <HistoryCard
                  key={o.id}
                  order={o}
                  restaurant={restaurants[o.restaurant_id]}
                  onDetails={() => navigate({ to: "/pedido/$id", params: { id: o.id } })}
                  onRepeat={() => repeatOrder(o)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Header({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  return (
    <header className="border-b bg-background/90 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            <Sparkles className="mr-1 inline h-3 w-3 text-primary" /> Minha conta
          </p>
          <h1 className="truncate font-display text-xl font-extrabold md:text-2xl">
            {name ? <>👋 Olá, {name}</> : "Meus pedidos"}
          </h1>
          <p className="text-xs text-muted-foreground">Acompanhe seus pedidos e histórico.</p>
        </div>
        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={name ?? ""} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {(name ?? "?").slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "primary" | "amber" | "emerald" | "rose";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-600",
  };
  return (
    <Card className="rounded-2xl border-0 p-4 shadow-sm transition hover:shadow-md">
      <div className={`mb-2 grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>{icon}</div>
      <p className="font-display text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function ActiveOrderCard({
  order,
  restaurant,
  onTrack,
}: {
  order: Order;
  restaurant?: RestaurantInfo;
  onTrack: () => void;
}) {
  const statusInfo: Record<string, { label: string; pct: number }> = {
    aguardando_pagamento: { label: "Aguardando pagamento", pct: 15 },
    pago: { label: "Aguardando aceite", pct: 25 },
    aceito: { label: "Pedido aceito", pct: 40 },
    em_preparo: { label: "Preparando seu pedido", pct: 60 },
    pronto: { label: "Pedido pronto", pct: 80 },
    saiu_para_entrega: { label: "Saiu para entrega", pct: 90 },
  };
  const info = statusInfo[order.status] ?? { label: order.status, pct: 50 };
  return (
    <Card className="rounded-3xl border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-background shadow-sm">
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="h-full w-full object-cover" />
          ) : (
            <Utensils className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-extrabold">{restaurant?.name ?? "Pedido em andamento"}</p>
          <p className="text-xs text-muted-foreground">
            Pedido {order.order_number ? `#${order.order_number}` : ""}
          </p>
        </div>
        <Badge className="rounded-full bg-primary/15 text-primary border-0">{info.label}</Badge>
      </div>

      <div className="mt-4">
        <Progress value={info.pct} className="h-2" />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Tempo estimado</span>
          <span className="font-semibold text-foreground">
            {order.estimated_delivery_time ?? 35} minutos
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={onTrack} className="flex-1 rounded-full">
          Acompanhar <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <Button onClick={onTrack} variant="outline" className="rounded-full">
          Ver detalhes
        </Button>
      </div>
    </Card>
  );
}

function HistoryCard({
  order,
  restaurant,
  onDetails,
  onRepeat,
}: {
  order: Order;
  restaurant?: RestaurantInfo;
  onDetails: () => void;
  onRepeat: () => void;
}) {
  return (
    <Card className="rounded-2xl border-0 p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted">
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="h-full w-full object-cover" />
          ) : (
            <Utensils className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{restaurant?.name ?? "Restaurante"}</p>
          <p className="text-xs text-muted-foreground">{formatWhen(order.created_at)}</p>
        </div>
        <div className="text-right">
          <p className="font-display font-extrabold text-primary">{brl(Number(order.total))}</p>
          <StatusBadge status={order.status} />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={onDetails}>
          Ver detalhes
        </Button>
        {restaurant?.slug && (
          <Button size="sm" className="rounded-full" onClick={onRepeat}>
            <RotateCw className="mr-1 h-4 w-4" /> Pedir novamente
          </Button>
        )}
      </div>
    </Card>
  );
}

function EmptyState({ onExplore }: { onExplore: () => void }) {
  return (
    <Card className="rounded-3xl border-0 p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-primary/10">
        <ShoppingBag className="h-10 w-10 text-primary" />
      </div>
      <h3 className="font-display text-lg font-extrabold">Você ainda não fez nenhum pedido.</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Escolha um restaurante e faça seu primeiro pedido.
      </p>
      <Button onClick={onExplore} className="mt-6 rounded-full" size="lg">
        Explorar restaurante
      </Button>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    novo: { label: "Recebido", cls: "bg-primary/10 text-primary border-primary/30" },
    aguardando_pagamento: { label: "Aguardando pagamento", cls: "bg-slate-500/10 text-slate-700 border-slate-500/30" },
    pago: { label: "Aguardando aceite", cls: "bg-primary/10 text-primary border-primary/30" },
    aceito: { label: "Aceito", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    em_preparo: { label: "Em Preparo", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    pronto: { label: "Pronto", cls: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30" },
    saiu_para_entrega: { label: "Saiu p/ Entrega", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
    entregue: { label: "Entregue", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
    cancelado: { label: "Cancelado", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  };
  const m = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={`mt-1 text-[10px] ${m.cls}`}>{m.label}</Badge>;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Hoje • ${time}`;
  if (isYest) return `Ontem • ${time}`;
  return `${d.toLocaleDateString("pt-BR")} • ${time}`;
}
