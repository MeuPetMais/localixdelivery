import { useQuery } from "@tanstack/react-query";
import { FinanceDomain, normalizeFilters, type FinanceFilters } from "@/lib/finance";
import { WidgetCard, WidgetHeader, WidgetLoading, WidgetEmpty } from "@/components/dashboard/WidgetPrimitives";
import { brl } from "@/lib/format";

const service = FinanceDomain.createPayablesService();

export function PayablesWidget({
  restaurantId,
  filters,
}: {
  restaurantId: string;
  filters: Partial<FinanceFilters>;
}) {
  const f = normalizeFilters(filters);
  const q = useQuery({
    queryKey: ["finance", "payables", restaurantId, f.from, f.to],
    queryFn: () => service.getSummary({ restaurantId, from: f.from!, to: f.to! }),
    enabled: !!restaurantId,
    staleTime: 30_000,
  });

  if (q.isLoading) return <WidgetCard span={4}><WidgetHeader title="Pagamentos" /><WidgetLoading /></WidgetCard>;
  if (!q.data) return <WidgetCard span={4}><WidgetHeader title="Pagamentos" /><WidgetEmpty /></WidgetCard>;

  const d = q.data;
  const cards: Array<[string, string]> = [
    ["Pagos", brl(d.paid)],
    ["Em aberto", brl(d.open)],
    ["Vencidos", brl(d.overdue)],
    ["Próx. 7 dias", brl(d.next7)],
    ["Próx. 30 dias", brl(d.next30)],
  ];

  return (
    <WidgetCard span={4}>
      <WidgetHeader title="Contas a pagar" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-lg bg-muted/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div>
            <div className="mt-1 font-display text-lg font-bold">{v}</div>
          </div>
        ))}
      </div>
      {d.items.length === 0 ? (
        <div className="mt-4"><WidgetEmpty description="Sem contas a pagar no período." /></div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr><th className="py-2 text-left">Vencimento</th><th className="text-left">Descrição</th><th className="text-left">Categoria</th><th className="text-right">Valor</th><th className="text-left">Status</th></tr>
            </thead>
            <tbody>
              {d.items.slice(0, 10).map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{p.due_date ?? "—"}</td>
                  <td>{p.description}</td>
                  <td>{p.category ?? "—"}</td>
                  <td className="text-right">{brl(p.amount)}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}
