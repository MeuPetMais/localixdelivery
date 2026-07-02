import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSuperadminOverview } from "@/lib/superadmin.functions";
import { brl } from "@/lib/format";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { ShoppingBag, DollarSign, Building2, Users, TrendingUp, Percent, Receipt, CircleDollarSign } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Dashboard Geral" }] }),
  component: AdminDashboard,
});

const RANGES: Record<string, () => { from: string; to: string }> = {
  today: () => { const d = new Date().toISOString().slice(0,10); return { from: d, to: d }; },
  "7d":  () => { const to = new Date(); const from = new Date(to.getTime() - 6*86400000); return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }; },
  "30d": () => { const to = new Date(); const from = new Date(to.getTime() - 29*86400000); return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }; },
  month: () => { const to = new Date(); const from = new Date(to.getFullYear(), to.getMonth(), 1); return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }; },
  year:  () => { const to = new Date(); const from = new Date(to.getFullYear(), 0, 1); return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }; },
};

const COLORS = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#eab308", "#ef4444"];

function AdminDashboard() {
  const [range, setRange] = useState<keyof typeof RANGES>("30d");
  const fn = useServerFn(getSuperadminOverview);
  const { from, to } = RANGES[range]();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview", range],
    queryFn: () => fn({ data: { from, to } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Geral</h1>
          <p className="text-sm text-slate-400">Indicadores em tempo real da plataforma.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {Object.keys(RANGES).map(k => (
            <button key={k} onClick={() => setRange(k as any)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${range===k ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-slate-800"}`}>
              {k === "today" ? "Hoje" : k === "month" ? "Este mês" : k === "year" ? "Este ano" : k}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Pedidos hoje" value={String(data?.ordersToday ?? 0)} icon={ShoppingBag} loading={isLoading} />
        <Kpi label="Pedidos do mês" value={String(data?.ordersMonth ?? 0)} icon={ShoppingBag} loading={isLoading} />
        <Kpi label="Receita bruta (GMV)" value={brl(data?.gmv ?? 0)} icon={CircleDollarSign} loading={isLoading} />
        <Kpi label="Receita da plataforma" value={brl(data?.platformRevenue ?? 0)} icon={DollarSign} loading={isLoading} />
        <Kpi label="Receita comissões (5%)" value={brl(data?.commissionRevenue ?? 0)} icon={Percent} loading={isLoading} />
        <Kpi label="Receita taxa fixa (R$0,99/pedido)" value={brl(data?.fixedRevenue ?? 0)} icon={Receipt} loading={isLoading} />
        <Kpi label="Restaurantes ativos" value={String(data?.restaurantsActive ?? 0)} icon={Building2} loading={isLoading} />
        <Kpi label="Restaurantes inativos" value={String(data?.restaurantsInactive ?? 0)} icon={Building2} loading={isLoading} />
        <Kpi label="Clientes cadastrados" value={String(data?.customersTotal ?? 0)} icon={Users} loading={isLoading} />
        <Kpi label="Novos cadastros (período)" value={String(data?.customersNew ?? 0)} icon={Users} loading={isLoading} />
        <Kpi label="Ticket médio" value={brl(data?.avgTicket ?? 0)} icon={CircleDollarSign} loading={isLoading} />
        <Kpi label="Crescimento diário" value={`${(data?.dailyGrowth ?? 0).toFixed(1)}%`} icon={TrendingUp} loading={isLoading}
          tone={(data?.dailyGrowth ?? 0) >= 0 ? "up" : "down"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Faturamento diário">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.dailyRevenue ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Pedidos por hora">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.hourly ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="h" stroke="#94a3b8" fontSize={10} interval={2} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Bar dataKey="count" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Meios de pagamento">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data?.paymentMethods ?? []} dataKey="value" nameKey="name" outerRadius={90} label>
                {(data?.paymentMethods ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Itens mais vendidos">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.topItems ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={110} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Bar dataKey="qty" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, loading, tone }: { label: string; value: string; icon: any; loading?: boolean; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon className={`h-4 w-4 ${tone === "down" ? "text-red-400" : "text-primary"}`} />
      </div>
      <div className={`mt-2 text-2xl font-bold ${tone === "down" ? "text-red-400" : tone === "up" ? "text-green-400" : ""}`}>
        {loading ? "…" : value}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">{title}</h3>
      {children}
    </div>
  );
}
