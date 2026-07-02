import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminTransactions } from "@/lib/superadmin.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/admin/transacoes")({
  head: () => ({ meta: [{ title: "Admin — Gestão Financeira" }] }),
  component: TxPage,
});

function preset(k: string) {
  const to = new Date();
  let from = new Date(to.getFullYear(), to.getMonth(), 1);
  if (k === "today") from = to;
  if (k === "week") from = new Date(to.getTime() - 6 * 86400000);
  if (k === "year") from = new Date(to.getFullYear(), 0, 1);
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) };
}

function TxPage() {
  const fn = useServerFn(listAdminTransactions);
  const [range, setRange] = useState("month");
  const [payment, setPayment] = useState("all");
  const p = preset(range);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-tx", range, payment],
    queryFn: () => fn({ data: { ...p, payment } }),
  });

  const payments = [
    { k: "all", l: "Todos" },
    { k: "pix", l: "PIX" },
    { k: "card", l: "Cartão" },
    { k: "cash", l: "Dinheiro" },
    { k: "online", l: "Online" },
  ];
  const ranges = [
    { k: "today", l: "Hoje" },
    { k: "week", l: "Semana" },
    { k: "month", l: "Mês" },
    { k: "year", l: "Ano" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão Financeira</h1>
        <p className="text-sm text-slate-400">Todas as movimentações da plataforma.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {ranges.map(({ k, l }) => (
            <button key={k} onClick={() => setRange(k)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${range===k ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-slate-800"}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {payments.map(({ k, l }) => (
            <button key={k} onClick={() => setPayment(k)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${payment===k ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-slate-800"}`}>{l}</button>
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
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Comissão</th>
              <th className="px-4 py-3 text-right">Taxa</th>
              <th className="px-4 py-3 text-right">Líquido</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} className="p-6 text-center text-slate-400">Carregando…</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={10} className="p-6 text-center text-slate-400">Sem transações.</td></tr>}
            {(data ?? []).map(t => (
              <tr key={t.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                <td className="px-4 py-3 text-slate-300">{new Date(t.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 font-mono text-xs">#{t.order_number ?? t.id.slice(0,6)}</td>
                <td className="px-4 py-3">{t.restaurant_name}</td>
                <td className="px-4 py-3 text-slate-300">{t.customer_name ?? "—"}</td>
                <td className="px-4 py-3 uppercase text-slate-300">{t.payment_method ?? "—"}</td>
                <td className="px-4 py-3 text-right">{brl(t.gross)}</td>
                <td className="px-4 py-3 text-right text-yellow-300">{brl(t.commission)}</td>
                <td className="px-4 py-3 text-right text-yellow-300">{brl(t.fee)}</td>
                <td className="px-4 py-3 text-right text-green-400">{brl(t.net)}</td>
                <td className="px-4 py-3 text-center">
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-200">{t.status ?? "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
