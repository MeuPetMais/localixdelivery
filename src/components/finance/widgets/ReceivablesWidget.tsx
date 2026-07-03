import { useQuery } from "@tanstack/react-query";
import { FinanceDomain, normalizeFilters, type FinanceFilters } from "@/lib/finance";
import { WidgetCard, WidgetHeader, WidgetLoading, WidgetEmpty } from "@/components/dashboard/WidgetPrimitives";
import { brl } from "@/lib/format";

const service = FinanceDomain.createReceivablesService();

export function ReceivablesWidget({
  restaurantId,
  filters,
}: {
  restaurantId: string;
  filters: Partial<FinanceFilters>;
}) {
  const f = normalizeFilters(filters);
  const q = useQuery({
    queryKey: ["finance", "receivables", restaurantId, f.from, f.to],
    queryFn: () => service.getSummary({ restaurantId, from: f.from!, to: f.to! }),
    enabled: !!restaurantId,
    staleTime: 30_000,
  });

  if (q.isLoading) return <WidgetCard span={4}><WidgetHeader title="Recebimentos" /><WidgetLoading /></WidgetCard>;
  if (!q.data) return <WidgetCard span={4}><WidgetHeader title="Recebimentos" /><WidgetEmpty /></WidgetCard>;

  const d = q.data;
  const cards: Array<[string, string]> = [
    ["Recebidos", brl(d.received)],
    ["Pendentes", brl(d.pending)],
    ["Atrasados", brl(d.overdue)],
    ["Próx. 7 dias", brl(d.next7)],
    ["Próx. 30 dias", brl(d.next30)],
  ];

  return (
    <WidgetCard span={4}>
      <WidgetHeader title="Recebimentos" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-lg bg-muted/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div>
            <div className="mt-1 font-display text-lg font-bold">{v}</div>
          </div>
        ))}
      </div>
      {d.items.length === 0 ? (
        <div className="mt-4"><WidgetEmpty description="Sem recebimentos no período." /></div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr><th className="py-2 text-left">Vencimento</th><th className="text-left">Gateway</th><th className="text-right">Bruto</th><th className="text-right">Líquido</th><th className="text-left">Status</th></tr>
            </thead>
            <tbody>
              {d.items.slice(0, 10).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">{r.expected_date ?? "—"}</td>
                  <td>{r.gateway ?? "—"}</td>
                  <td className="text-right">{brl(r.gross_amount)}</td>
                  <td className="text-right">{brl(r.net_amount)}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}
