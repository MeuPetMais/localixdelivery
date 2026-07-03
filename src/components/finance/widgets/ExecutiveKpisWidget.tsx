import { useQuery } from "@tanstack/react-query";
import { FinanceDomain, type FinanceFilters } from "@/lib/finance";
import { WidgetCard, WidgetHeader, WidgetLoading, WidgetEmpty } from "@/components/dashboard/WidgetPrimitives";
import { brl } from "@/lib/format";

const service = FinanceDomain.createDashboardService();

export function ExecutiveKpisWidget({
  restaurantId,
  filters,
}: {
  restaurantId: string;
  filters: Partial<FinanceFilters>;
}) {
  const q = useQuery({
    queryKey: ["finance", "kpis", restaurantId, filters],
    queryFn: () => service.getExecutiveKPIs({ restaurantId, filters }),
    enabled: !!restaurantId,
    staleTime: 30_000,
  });

  if (q.isLoading) return <WidgetCard span={4}><WidgetHeader title="Resumo executivo" /><WidgetLoading /></WidgetCard>;
  if (!q.data) return <WidgetCard span={4}><WidgetHeader title="Resumo executivo" /><WidgetEmpty description="Sem dados no período." /></WidgetCard>;

  const k = q.data;
  const items: Array<[string, string]> = [
    ["Receita bruta", brl(k.grossRevenue)],
    ["Receita líquida", brl(k.netRevenue)],
    ["Lucro bruto", brl(k.grossProfit)],
    ["Lucro líquido", brl(k.netProfit)],
    ["CMV", brl(k.cmv)],
    ["Margem", `${k.marginPct.toFixed(1)}%`],
    ["Pedidos", String(k.orders)],
    ["Ticket médio", brl(k.averageTicket)],
    ["Saldo atual", brl(k.currentBalance)],
    ["A receber", brl(k.pendingReceivables)],
    ["A pagar", brl(k.pendingPayables)],
  ];

  return (
    <WidgetCard span={4}>
      <WidgetHeader title="Resumo executivo" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 font-display text-lg font-bold">{value}</div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
