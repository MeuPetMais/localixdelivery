import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminTransactions } from "@/lib/superadmin.functions";
import { adminPresetRangeUTC } from "@/lib/admin-finance-contract";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/admin/transacoes")({
  head: () => ({ meta: [{ title: "Admin - Gestao Financeira" }] }),
  component: TxPage,
});

function preset(key: string) {
  if (key === "today") return adminPresetRangeUTC("today");
  if (key === "week") return adminPresetRangeUTC("week");
  if (key === "year") return adminPresetRangeUTC("year");
  return adminPresetRangeUTC("month");
}

function TxPage() {
  const fn = useServerFn(listAdminTransactions);
  const [range, setRange] = useState("month");
  const [payment, setPayment] = useState("all");
  const period = preset(range);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-tx", range, payment],
    queryFn: () => fn({ data: { ...period, payment } }),
  });

  const payments = [
    { k: "all", l: "Todos" },
    { k: "pix", l: "PIX" },
    { k: "credit_card", l: "Credito" },
    { k: "debit_card", l: "Debito" },
    { k: "cash", l: "Dinheiro" },
    { k: "card_on_delivery", l: "Cartao entrega" },
  ];
  const ranges = [
    { k: "today", l: "Hoje" },
    { k: "week", l: "Semana" },
    { k: "month", l: "Mes" },
    { k: "year", l: "Ano" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestao Financeira</h1>
        <p className="text-sm text-slate-400">Movimentos por pedido com valores persistidos no snapshot.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {ranges.map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                range === k ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {payments.map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setPayment(k)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                payment === k ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Pedido</th>
              <th className="px-4 py-3 text-left">Parceiro</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Pagamento</th>
              <th className="px-4 py-3 text-right">Total cliente</th>
              <th className="px-4 py-3 text-right">Taxa plataforma</th>
              <th className="px-4 py-3 text-right">Receita realizada</th>
              <th className="px-4 py-3 text-right">Liquido parceiro</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} className="p-6 text-center text-slate-400">Carregando...</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={10} className="p-6 text-center text-slate-400">Sem transacoes.</td></tr>}
            {(data ?? []).map((transaction) => (
              <tr key={transaction.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                <td className="px-4 py-3 text-slate-300">{new Date(transaction.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 font-mono text-xs">#{transaction.order_number ?? transaction.id.slice(0, 6)}</td>
                <td className="px-4 py-3">{transaction.restaurant_name}</td>
                <td className="px-4 py-3 text-slate-300">{transaction.customer_name ?? "-"}</td>
                <td className="px-4 py-3 uppercase text-slate-300">{transaction.payment_method ?? "-"}</td>
                {transaction.financialSnapshotAvailable ? (
                  <>
                    <td className="px-4 py-3 text-right">{brl(transaction.gross)}</td>
                    <td className="px-4 py-3 text-right text-yellow-300">{brl(transaction.fee)}</td>
                    <td className="px-4 py-3 text-right text-primary">{brl(transaction.realized_platform_revenue)}</td>
                    <td className="px-4 py-3 text-right text-green-400">{brl(transaction.net)}</td>
                  </>
                ) : (
                  <td colSpan={4} className="px-4 py-3 text-right text-xs text-amber-300">
                    Snapshot financeiro indisponivel
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-200">{transaction.status ?? "-"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
