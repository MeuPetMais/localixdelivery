import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl, slugify } from "@/lib/format";
import { useRestaurant, useRestaurantContext } from "@/contexts/RestaurantContext";
import { toast } from "sonner";
import {
  ExternalLink,
  Copy,
  Power,
  Loader2,
  ShoppingBag,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Plus,
  Megaphone,
  Ticket,
  Wallet,
  Package,
  ChefHat,
  Bike,
  CheckCircle2,
  Clock,
  Bell,
  ChevronDown,
  Share2,
  Instagram,
  Facebook,
  MessageCircle,
  Store,
  Lightbulb,
  Crown,
  UserCheck,
  UserX,
  Award,
  Gift,
  Coins,
  Activity as ActivityIcon,
  ShoppingCart,
  TicketCheck,
  UserPlus,
  PackagePlus,
  PackageCheck,
} from "lucide-react";
import { getDashboardData } from "@/lib/dashboard.functions";
import { useRestaurantStatus } from "@/hooks/use-restaurant-status";
import { DemoDashboardCards, DemoExtraMetrics, DemoAiCard, getDemoKpisOverride } from "@/components/DemoDashboardCards";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { NewOrderCard } from "@/components/NewOrderCard";
import { MerchantNotificationsBell } from "@/components/MerchantNotificationsBell";
import { DateRangeFilter, computePreset, type DateRange } from "@/components/DateRangeFilter";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Localix" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext() as { user: { id: string; email?: string } };
  const qc = useQueryClient();
  const restaurant = useRestaurant();
  const { invalidate: invalidateRestaurant } = useRestaurantContext();

  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [dateRange, setDateRange] = useState<DateRange>(() => computePreset("30d"));
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [togglingOpen, setTogglingOpen] = useState(false);

  const fetchDash = useServerFn(getDashboardData);
  const { data: dash } = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["dashboard", restaurant?.id, period],
    queryFn: () => fetchDash({ data: { restaurantId: restaurant!.id, period } }),
    refetchInterval: 60_000,
  });

  // Realtime é gerenciado globalmente pelo OrdersRealtimeProvider
  // (uma única assinatura por restaurante). Aqui não abrimos canal extra.

  async function toggleOpen() {
    if (togglingOpen) return;
    setTogglingOpen(true);
    const next = !restaurant.is_open;
    console.log("[toggleOpen] Status atual:", restaurant.is_open, "→ Novo:", next);
    const { data, error } = await supabase
      .from("restaurants")
      .update({ is_open: next })
      .eq("id", restaurant.id)
      .eq("owner_id", user.id)
      .select("id, is_open")
      .maybeSingle();
    setTogglingOpen(false);
    if (error) {
      console.error("[toggleOpen] erro:", error);
      return toast.error(error.message || "Não foi possível atualizar o status.");
    }
    if (!data) {
      console.error("[toggleOpen] nenhuma linha atualizada — verifique RLS/owner");
      return toast.error("Não foi possível atualizar (permissão negada).");
    }
    console.log("[toggleOpen] resultado:", data);
    await invalidateRestaurant();
    toast.success(next ? "Loja aberta com sucesso" : "Loja fechada com sucesso");
  }

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${restaurant.slug}`;
  const isDemo = restaurant.slug === "demo";
  const k = isDemo ? getDemoKpisOverride(dash?.kpis) : dash?.kpis;

  const status = useRestaurantStatus({
    is_open: restaurant.is_open,
    opening_hours: (restaurant as any).opening_hours,
  });
  if (typeof window !== "undefined") {
    // Temporary diagnostics (dashboard)
    // eslint-disable-next-line no-console
    console.log("[status:dashboard]", {
      manualStatus: status.manualStatus,
      isOpen: status.isOpen,
      todaySchedule: (restaurant as any).opening_hours ?? null,
      computedStatus: status.reason,
    });
  }
  const openLabel = status.isOpen ? "Aberto" : "Fechado";
  const offSchedule = status.reason === "off_schedule";

  return (
    <div className="max-w-full space-y-6">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">
            Olá, {restaurant.name} 👋
          </h1>
          <p className="text-sm text-muted-foreground">Aqui está o resumo do seu negócio hoje.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-accent"
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Hoje
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            aria-label="Notificações"
            className="relative grid h-9 w-9 place-items-center rounded-lg border bg-background shadow-sm transition hover:bg-accent"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
          </button>
          <div className="flex items-center gap-2 rounded-lg border bg-background py-1 pl-1 pr-3 shadow-sm">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-warm text-xs font-bold text-primary-foreground">
              {(restaurant.name ?? "L").charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">
              {user.email ?? restaurant.name}
            </span>
          </div>
          <div
            className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium md:flex ${
              status.isOpen
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
            title={offSchedule ? "Fora do horário de funcionamento" : undefined}
          >
            <span className={`h-2 w-2 rounded-full ${status.isOpen ? "bg-success" : "bg-destructive"} animate-pulse`} />
            {openLabel}
            {offSchedule && <span className="ml-1 text-[10px] opacity-75">(fora do horário)</span>}
          </div>
          <Button variant="outline" size="sm" onClick={toggleOpen} disabled={togglingOpen}>
            {togglingOpen ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
            {restaurant.is_open ? "Fechar manualmente" : "Abrir loja"}
          </Button>
        </div>
      </header>

      <ProfileCompletionBanner restaurant={restaurant} />

      <NewOrderCard />

      <ActivePromosBanner restaurantId={restaurant.id} />

      {/* Loja Online + Marketing cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="relative overflow-hidden border-primary/20 p-5 shadow-sm">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold">Sua Loja Online</h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    status.isOpen ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${status.isOpen ? "bg-success" : "bg-destructive"}`} />
                  {status.isOpen ? "Online" : "Offline"}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{publicUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <Button size="sm" className="h-8">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir página
                  </Button>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    navigator.clipboard.writeText(publicUrl);
                    toast.success("Link copiado!");
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: restaurant.name, url: publicUrl });
                      } catch {
                        /* user cancelled */
                      }
                    } else {
                      navigator.clipboard.writeText(publicUrl);
                      toast.success("Link copiado para compartilhar!");
                    }
                  }}
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" /> Compartilhar
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-warm p-5 text-primary-foreground shadow-glow">
          <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-primary-foreground/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              <h3 className="font-display text-base font-bold">Divulgue e venda mais</h3>
            </div>
            <p className="mt-1 text-sm opacity-90">
              Compartilhe sua loja nas redes e atraia mais pedidos hoje mesmo.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Peça pelo ${restaurant.name}: ${publicUrl}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button size="sm" variant="secondary" className="h-8">
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                </Button>
              </a>
              <a
                href={`https://www.instagram.com/`}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  navigator.clipboard.writeText(`Peça pelo ${restaurant.name}: ${publicUrl}`);
                  toast.success("Texto copiado! Cole no seu story.");
                }}
              >
                <Button size="sm" variant="secondary" className="h-8">
                  <Instagram className="mr-1.5 h-3.5 w-3.5" /> Instagram
                </Button>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button size="sm" variant="secondary" className="h-8">
                  <Facebook className="mr-1.5 h-3.5 w-3.5" /> Facebook
                </Button>
              </a>
            </div>
          </div>
        </Card>
      </div>


      {/* Row 1: KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Pedidos Hoje"
          value={k?.ordersToday ?? 0}
          delta={k?.ordersDelta ?? 0}
          icon={ShoppingBag}
          accent="from-[#FF5A1F]/10 to-transparent"
        />
        <KpiCard
          title="Faturamento Hoje"
          value={brl(k?.revenueToday ?? 0)}
          delta={k?.revenueDelta ?? 0}
          icon={DollarSign}
          accent="from-emerald-500/10 to-transparent"
        />
        <KpiCard
          title="Produtos Ativos"
          value={k?.productsActive ?? 0}
          delta={k?.productsDelta ?? 0}
          icon={Package}
          accent="from-blue-500/10 to-transparent"
        />
        <KpiCard
          title="Clientes Ativos"
          value={k?.activeCustomers ?? 0}
          delta={k?.activeDelta ?? 0}
          icon={Users}
          accent="from-violet-500/10 to-transparent"
        />
      </div>

      {isDemo && <DemoExtraMetrics />}
      {isDemo && <DemoDashboardCards publicUrl={publicUrl} restaurantId={restaurant.id} />}
      {isDemo && <DemoAiCard />}




      {/* Row 2: Revenue chart + Status donut */}
      <div className="grid gap-4 lg:grid-cols-10">
        <Card className="min-w-0 p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold">
                {metric === "revenue" ? "Faturamento" : "Pedidos"} — últimos {period} dias
              </h3>
              <p className="text-xs text-muted-foreground">
                {metric === "revenue" ? "Receita por dia" : "Quantidade de pedidos por dia"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border bg-background p-0.5 text-xs">
                {(["revenue", "orders"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      metric === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "revenue" ? "Receita" : "Pedidos"}
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-lg border bg-background p-0.5 text-xs">
                {([7, 30, 90] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p}d
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dash?.series ?? []} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF5A1F" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#FF5A1F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                <Tooltip
                  formatter={(v: number) => (metric === "revenue" ? brl(v) : `${v} pedido${v === 1 ? "" : "s"}`)}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Area type="monotone" dataKey={metric} stroke="#FF5A1F" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="min-w-0 p-5 lg:col-span-3">
          <StatusDonut data={dash?.statusBreakdown} />
        </Card>
      </div>

      {/* AI Insights */}
      <div className="grid gap-4">
        <Card className="min-w-0 p-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-bold">Resumo IA</h3>
              <p className="text-xs text-muted-foreground">Insights do seu negócio</p>
            </div>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(dash?.insights ?? []).map((ins, i) => (
              <li key={i} className="rounded-xl border bg-muted/30 p-3 text-sm leading-relaxed">
                {ins}
              </li>
            ))}
            {!dash && <li className="text-sm text-muted-foreground">Carregando insights…</li>}
          </ul>
        </Card>
      </div>


      {/* Row 3: Funnel */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Funil Operacional</h2>
          <Link to="/orders" className="text-xs text-primary hover:underline">
            Ver pedidos →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FunnelCard label="Pedidos Novos" value={dash?.funnel.novo ?? 0} icon={Clock} color="bg-amber-500" />
          <FunnelCard label="Em Preparo" value={dash?.funnel.preparo ?? 0} icon={ChefHat} color="bg-blue-500" />
          <FunnelCard label="Em Entrega" value={dash?.funnel.entrega ?? 0} icon={Bike} color="bg-violet-500" />
          <FunnelCard label="Entregues" value={dash?.funnel.entregue ?? 0} icon={CheckCircle2} color="bg-emerald-500" />
        </div>
      </section>

      {/* Row 4 & 5: Top products + Customer pie */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">Produtos Campeões</h3>
            <Link to="/menu" className="text-xs text-primary hover:underline">
              Cardápio →
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">Produto</th>
                  <th className="py-2 px-2 text-right font-medium">Vendas</th>
                  <th className="py-2 px-2 text-right font-medium">Receita</th>
                  <th className="py-2 pl-2 text-right font-medium">Margem</th>
                </tr>
              </thead>
              <tbody>
                {(dash?.topProducts ?? []).map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 pr-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                        <span className="truncate">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right font-medium">{p.qty}</td>
                    <td className="py-3 px-2 text-right">{brl(p.revenue)}</td>
                    <td className="py-3 pl-2 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.margin >= 50
                            ? "bg-emerald-500/15 text-emerald-600"
                            : p.margin >= 30
                              ? "bg-amber-500/15 text-amber-600"
                              : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {p.margin}%
                      </span>
                    </td>
                  </tr>
                ))}
                {(!dash || dash.topProducts.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma venda ainda nos últimos 30 dias.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="min-w-0 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">Clientes</h3>
            <Link to="/customers" className="text-xs text-primary hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[1fr_auto]">
            <div className="h-48 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Novos", value: dash?.customerSegments.new ?? 0, color: "#FF5A1F" },
                      { name: "Recorrentes", value: dash?.customerSegments.recurring ?? 0, color: "#3B82F6" },
                      { name: "VIP", value: dash?.customerSegments.vip ?? 0, color: "#A855F7" },
                    ]}
                    dataKey="value"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                  >
                    {["#FF5A1F", "#3B82F6", "#A855F7"].map((c) => (
                      <Cell key={c} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-sm">
              <SegRow color="#FF5A1F" label="Novos (30d)" value={dash?.customerSegments.new ?? 0} />
              <SegRow color="#3B82F6" label="Recorrentes" value={dash?.customerSegments.recurring ?? 0} />
              <SegRow color="#A855F7" label="VIP" value={dash?.customerSegments.vip ?? 0} />
              <li className="border-t pt-2 text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{dash?.customerSegments.total ?? 0}</span>
              </li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Dica Inteligente do Dia */}
      <Card className="relative overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-5 shadow-sm dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/20">
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-amber-400/20 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold">Dica Inteligente do Dia</h3>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                IA
              </span>
            </div>
            <p
              className="mt-1.5 text-sm leading-relaxed text-foreground/90"
              dangerouslySetInnerHTML={{
                __html: (dash?.dailyTip ?? "Carregando dica do dia…").replace(
                  /\*\*(.+?)\*\*/g,
                  '<strong class="font-semibold text-foreground">$1</strong>',
                ),
              }}
            />
          </div>
        </div>
      </Card>

      {/* Dashboard Executivo: Financeiro + CRM + Fidelidade */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Dashboard Executivo</h2>
          <span className="text-xs text-muted-foreground">Últimos {period} dias</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Resumo Financeiro */}
          <Card className="min-w-0 p-5">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Wallet className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-bold">Resumo Financeiro</h3>
                <Link to="/finance" className="text-xs text-primary hover:underline">
                  Ver detalhes →
                </Link>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm">
              <ExecRow label="Receita Bruta" value={brl(dash?.financial.grossRevenue ?? 0)} color="text-emerald-600" />
              <ExecRow label="Custos (CMV)" value={`- ${brl(dash?.financial.costs ?? 0)}`} muted />
              <ExecRow label="Despesas" value={`- ${brl(dash?.financial.expenses ?? 0)}`} muted />
              <li className="mt-2 flex items-center justify-between border-t pt-2.5">
                <span className="font-semibold">Lucro Líquido</span>
                <span
                  className={`font-display text-lg font-extrabold ${
                    (dash?.financial.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {brl(dash?.financial.netProfit ?? 0)}
                </span>
              </li>
            </ul>
          </Card>

          {/* CRM */}
          <Card className="min-w-0 p-5">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-bold">CRM</h3>
                <Link to="/customers" className="text-xs text-primary hover:underline">
                  Ver clientes →
                </Link>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              <CrmRow icon={Crown} color="bg-amber-500/15 text-amber-600" label="Clientes VIP" value={dash?.crm.vip ?? 0} />
              <CrmRow icon={UserCheck} color="bg-blue-500/15 text-blue-600" label="Frequentes" value={dash?.crm.frequent ?? 0} />
              <CrmRow icon={UserX} color="bg-rose-500/15 text-rose-600" label="Inativos (30d+)" value={dash?.crm.inactive ?? 0} />
              <li className="border-t pt-2.5 text-xs text-muted-foreground">
                Total de clientes: <span className="font-semibold text-foreground">{dash?.crm.total ?? 0}</span>
              </li>
            </ul>
          </Card>

          {/* Fidelidade */}
          <Card className="min-w-0 p-5">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Award className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-bold">Fidelidade</h3>
                <Link to="/loyalty" className="text-xs text-primary hover:underline">
                  Programa →
                </Link>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              <CrmRow icon={Coins} color="bg-amber-500/15 text-amber-600" label="Pontos emitidos" value={dash?.loyalty.pointsIssued ?? 0} />
              <CrmRow icon={TicketCheck} color="bg-blue-500/15 text-blue-600" label="Cupons utilizados" value={dash?.loyalty.couponsUsed ?? 0} />
              <li className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600">
                    <Gift className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-sm text-muted-foreground">Cashback distribuído</span>
                </div>
                <span className="font-display text-base font-bold">{brl(dash?.loyalty.cashbackDistributed ?? 0)}</span>
              </li>
            </ul>
          </Card>
        </div>
      </section>

      {/* Atividades Recentes */}
      <Card className="min-w-0 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ActivityIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-bold">Atividades Recentes</h3>
              <p className="text-xs text-muted-foreground">Tempo real</p>
            </div>
          </div>
        </div>
        <ol className="mt-4 space-y-3">
          {(dash?.timeline ?? []).map((a, i) => (
            <TimelineRow key={i} type={a.type} label={a.label} detail={a.detail} at={a.at} />
          ))}
          {dash && dash.timeline.length === 0 && (
            <li className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Nenhuma atividade recente. Suas movimentações aparecerão aqui.
            </li>
          )}
        </ol>
      </Card>

      {/* Row 6: Quick actions */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Ações Rápidas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <QuickAction to="/menu" icon={Plus} label="Novo Produto" />
          <QuickAction to="/ai" icon={Megaphone} label="Nova Campanha" />
          <QuickAction to="/loyalty" icon={Ticket} label="Criar Cupom" />
          <QuickAction to="/finance" icon={Wallet} label="Registrar Despesa" />
          <QuickAction to="/inventory" icon={Package} label="Atualizar Estoque" />
        </div>
      </section>
    </div>
  );
}

function ActivePromosBanner({ restaurantId }: { restaurantId: string }) {
  const { data: count = 0 } = useQuery({
    queryKey: ["active-promos-count", restaurantId],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("menu_items")
        .select("id,price,promo_price,promo_starts_at,promo_ends_at,is_available")
        .eq("restaurant_id", restaurantId)
        .not("promo_price", "is", null);
      return (data ?? []).filter((i: any) => {
        if (!i.is_available) return false;
        if (!i.promo_price || Number(i.promo_price) >= Number(i.price)) return false;
        if (i.promo_starts_at && nowIso < i.promo_starts_at) return false;
        if (i.promo_ends_at && nowIso > i.promo_ends_at) return false;
        return true;
      }).length;
    },
    refetchInterval: 60_000,
  });
  if (count === 0) return null;
  return (
    <Link
      to="/promotions"
      className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-gradient-to-r from-destructive/10 to-primary/5 px-4 py-3 transition hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-destructive text-destructive-foreground shadow">🔥</span>
        <div>
          <p className="font-display text-base font-extrabold">{count} {count === 1 ? "Promoção Ativa" : "Promoções Ativas"}</p>
          <p className="text-xs text-muted-foreground">Toque para gerenciar suas ofertas</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-primary">Ver todas →</span>
    </Link>
  );
}

function KpiCard({
  title,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  delta: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  const positive = delta >= 0;
  return (
    <Card className={`relative min-w-0 overflow-hidden border bg-gradient-to-br ${accent} p-5 shadow-sm transition hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-background/80 text-primary shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 truncate font-display text-3xl font-extrabold tracking-tight">{value}</p>
      <div className="mt-2 flex items-center gap-1 text-xs font-medium">
        {positive ? (
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
        )}
        <span className={positive ? "text-emerald-600" : "text-destructive"}>
          {positive ? "+" : ""}
          {delta.toFixed(1)}%
        </span>
        <span className="text-muted-foreground">vs ontem</span>
      </div>
    </Card>
  );
}

function FunnelCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card className="min-w-0 p-4">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color} text-white shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-extrabold leading-none">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function SegRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </li>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link to={to}>
      <Card className="group flex h-full min-w-0 cursor-pointer items-center gap-3 p-4 transition hover:border-primary/40 hover:shadow-md">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <span className="min-w-0 truncate text-sm font-semibold">{label}</span>
      </Card>
    </Link>
  );
}

function Onboarding({ ownerId, onCreated }: { ownerId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const finalSlug = slug || slugify(name);
    const { error } = await supabase.from("restaurants").insert({
      owner_id: ownerId,
      name,
      slug: finalSlug,
      whatsapp_phone: whatsapp,
      description: description || null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Restaurante criado!");
    onCreated();
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card className="p-8">
        <h1 className="font-display text-2xl font-extrabold">Vamos criar seu Localix 🍔</h1>
        <p className="mt-1 text-sm text-muted-foreground">Em menos de 1 minuto seu cardápio digital está no ar.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome do estabelecimento</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
              placeholder="Pizzaria do Zé"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">URL pública</Label>
            <div className="flex items-center rounded-md border bg-muted/40 px-3">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                id="slug"
                required
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="border-0 bg-transparent focus-visible:ring-0"
                placeholder="pizzaria-do-ze"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa">WhatsApp para receber pedidos</Label>
            <Input id="wa" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+55 11 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição curta (opcional)</Label>
            <Textarea
              id="desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="As melhores pizzas artesanais do bairro."
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar meu Localix
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function ExecRow({ label, value, color, muted }: { label: string; value: string; color?: string; muted?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className={`truncate text-sm ${muted ? "text-muted-foreground" : ""}`}>{label}</span>
      <span className={`font-display text-base font-bold tabular-nums ${color ?? ""}`}>{value}</span>
    </li>
  );
}

function CrmRow({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${color}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="font-display text-base font-bold tabular-nums">{value.toLocaleString("pt-BR")}</span>
    </li>
  );
}

const TIMELINE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  order: { icon: ShoppingCart, color: "bg-amber-500/15 text-amber-600" },
  delivered: { icon: PackageCheck, color: "bg-emerald-500/15 text-emerald-600" },
  coupon: { icon: TicketCheck, color: "bg-violet-500/15 text-violet-600" },
  customer: { icon: UserPlus, color: "bg-blue-500/15 text-blue-600" },
  product: { icon: PackagePlus, color: "bg-primary/15 text-primary" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function TimelineRow({ type, label, detail, at }: { type: string; label: string; detail: string; at: string }) {
  const meta = TIMELINE_META[type] ?? TIMELINE_META.order;
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${meta.color}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <p className="truncate text-sm font-semibold">{label}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(at)}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}


const STATUS_LABELS: Record<string, string> = {
  novo: "Novo Pedido",
  preparo: "Em Preparo",
  entrega: "Saiu p/ Entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  novo: "#f59e0b",
  preparo: "#3b82f6",
  entrega: "#8b5cf6",
  entregue: "#10b981",
  cancelado: "#ef4444",
};

function StatusDonut({ data }: { data?: Record<string, number> | null }) {
  const entries = Object.entries(data ?? {}).map(([status, count]) => ({
    status,
    label: STATUS_LABELS[status] ?? status,
    value: count as number,
    color: STATUS_COLORS[status] ?? "#94a3b8",
  }));
  const total = entries.reduce((acc, e) => acc + e.value, 0);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-bold">Status dos Pedidos</h3>
          <p className="text-xs text-muted-foreground">Distribuição atual</p>
        </div>
        <ShoppingBag className="h-4 w-4 text-primary" />
      </div>
      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Nenhum pedido ainda.</p>
      ) : (
        <>
          <div className="relative mx-auto mt-2 h-36 w-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={entries}
                  dataKey="value"
                  innerRadius={42}
                  outerRadius={62}
                  paddingAngle={2}
                  stroke="none"
                >
                  {entries.map((e) => (
                    <Cell key={e.status} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, _n, p: { payload?: { label: string } }) => [
                    `${v} (${Math.round((v / total) * 100)}%)`,
                    p.payload?.label ?? "",
                  ]}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-xl font-bold leading-none">{total}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {entries.map((e) => (
              <li key={e.status} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
                  <span className="truncate text-muted-foreground">{e.label}</span>
                </div>
                <span className="font-medium tabular-nums">
                  {e.value}
                  <span className="ml-1 text-muted-foreground">
                    ({Math.round((e.value / total) * 100)}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

