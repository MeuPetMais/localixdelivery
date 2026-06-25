import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl, slugify } from "@/lib/format";
import { toast } from "sonner";
import {
  ExternalLink,
  Copy,
  Power,
  Loader2,
  ShoppingBag,
  DollarSign,
  Receipt,
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
} from "lucide-react";
import { getDashboardData } from "@/lib/dashboard.functions";
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

  const { data: restaurant, isLoading, refetch } = useQuery({
    queryKey: ["restaurant", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const fetchDash = useServerFn(getDashboardData);
  const { data: dash } = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["dashboard", restaurant?.id],
    queryFn: () => fetchDash({ data: { restaurantId: restaurant!.id } }),
    refetchInterval: 60_000,
  });

  // Realtime: refresh dashboard when orders change
  useEffect(() => {
    if (!restaurant?.id) return;
    const ch = supabase
      .channel(`dashboard-orders-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => qc.invalidateQueries({ queryKey: ["dashboard", restaurant.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurant?.id, qc]);

  if (isLoading) return <Loader />;
  if (!restaurant) return <Onboarding ownerId={user.id} onCreated={() => refetch()} />;

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${restaurant.slug}`;

  async function toggleOpen() {
    const { error } = await supabase.from("restaurants").update({ is_open: !restaurant!.is_open }).eq("id", restaurant!.id);
    if (error) return toast.error(error.message);
    toast.success(restaurant!.is_open ? "Loja fechada" : "Loja aberta");
    refetch();
  }

  const k = dash?.kpis;

  return (
    <div className="max-w-full space-y-6">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">
            Olá, {restaurant.name} 👋
          </h1>
          <p className="text-sm text-muted-foreground">Visão geral do seu negócio em tempo real.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium sm:flex ${
              restaurant.is_open
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${restaurant.is_open ? "bg-success" : "bg-destructive"} animate-pulse`} />
            {restaurant.is_open ? "Aberto" : "Fechado"}
          </div>
          <Button variant="outline" size="sm" onClick={toggleOpen}>
            <Power className="mr-2 h-4 w-4" />
            {restaurant.is_open ? "Fechar" : "Abrir"}
          </Button>
        </div>
      </header>

      {/* Public link banner */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-warm p-5 text-primary-foreground shadow-glow">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Sua página de pedidos</p>
            <p className="mt-1 truncate font-display text-lg font-bold sm:text-xl">{publicUrl}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Link copiado!");
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar
            </Button>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" /> Abrir
              </Button>
            </a>
          </div>
        </div>
      </Card>

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
          title="Ticket Médio"
          value={brl(k?.ticketToday ?? 0)}
          delta={k?.ticketDelta ?? 0}
          icon={Receipt}
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

      {/* Row 2: Chart + AI insights */}
      <div className="grid gap-4 lg:grid-cols-10">
        <Card className="min-w-0 p-5 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold">Vendas — últimos 30 dias</h3>
              <p className="text-xs text-muted-foreground">Faturamento diário</p>
            </div>
            <Sparkles className="h-4 w-4 text-primary" />
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
                  formatter={(v: number) => brl(v)}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#FF5A1F" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="min-w-0 p-5 lg:col-span-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-bold">Resumo IA</h3>
              <p className="text-xs text-muted-foreground">Insights do seu negócio</p>
            </div>
          </div>
          <ul className="mt-4 space-y-3">
            {(dash?.insights ?? []).map((ins, i) => (
              <li key={i} className="rounded-xl border bg-muted/30 p-3 text-sm leading-relaxed">
                {ins}
              </li>
            ))}
            {!dash && <li className="text-sm text-muted-foreground">Carregando insights…</li>}
          </ul>
          <Link to="/ai">
            <Button variant="ghost" size="sm" className="mt-3 w-full">
              Ver Central de IA →
            </Button>
          </Link>
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
              <span className="text-sm text-muted-foreground">/r/</span>
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
