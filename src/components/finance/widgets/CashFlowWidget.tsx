import { useQuery } from "@tanstack/react-query";
import { FinanceDomain, normalizeFilters, type FinanceFilters } from "@/lib/finance";
import { WidgetCard, WidgetHeader, WidgetLoading, WidgetEmpty } from "@/components/dashboard/WidgetPrimitives";
import { brl } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const service = FinanceDomain.createCashFlowService();

export function CashFlowWidget({
  restaurantId,
  filters,
}: {
  restaurantId: string;
  filters: Partial<FinanceFilters>;
}) {
  const f = normalizeFilters(filters);
  const q = useQuery({
    queryKey: ["finance", "cashflow", restaurantId, f.from, f.to],
    queryFn: () => service.getSummary({ restaurantId, from: f.from!, to: f.to! }),
    enabled: !!restaurantId,
    staleTime: 30_000,
  });

  if (q.isLoading) return <WidgetCard span={4}><WidgetHeader title="Fluxo de caixa" /><WidgetLoading /></WidgetCard>;
  if (!q.data) return <WidgetCard span={4}><WidgetHeader title="Fluxo de caixa" /><WidgetEmpty /></WidgetCard>;

  const d = q.data;
  const cards: Array<[string, string]> = [
    ["Saldo atual", brl(d.balance)],
    ["Entradas hoje", brl(d.today.inflow)],
    ["Saídas hoje", brl(d.today.outflow)],
    ["Entradas período", brl(d.period.inflow)],
    ["Saídas período", brl(d.period.outflow)],
    ["Resultado período", brl(d.period.net)],
  ];

  return (
    <WidgetCard span={4}>
      <WidgetHeader title="Fluxo de caixa" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-lg bg-muted/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div>
            <div className="mt-1 font-display text-lg font-bold">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 h-56">
        {d.timeline.length === 0 ? <WidgetEmpty description="Sem movimentações no período." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="runningBalance" name="Saldo" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="inflow" name="Entradas" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="outflow" name="Saídas" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </WidgetCard>
  );
}
