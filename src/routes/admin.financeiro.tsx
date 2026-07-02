import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformFinance } from "@/lib/superadmin.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/admin/financeiro")({
  head: () => ({ meta: [{ title: "Admin — Financeiro da Plataforma" }] }),
  component: FinancePage,
});

const RANGES: Record<string, () => { from: string; to: string; label: string }> = {
  today:{ label: "Hoje" } as any,
} as any;

function preset(k: string) {
  const to = new Date();
  let from = new Date();
  if (k === "today") from = to;
  if (k === "week") from = new Date(to.getTime() - 6 * 86400000);
  if (k === "month") from = new Date(to.getFullYear(), to.getMonth(), 1);
  if (k === "year") from = new Date(to.getFullYear(), 0, 1);
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) };
}

function FinancePage() {
  const [range, setRange] = useState("month");
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const fn = useServerFn(getPlatformFinance);
  const p = custom ?? preset(range);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-finance", range, custom],
    queryFn: () => fn({ data: p }),
  });

  const presets = [
    { k: "today", l: "Hoje" },
    { k: "week", l: "Semana" },
    { k: "month", l: "Mês" },
    { k: "year", l: "Ano" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro da Plataforma</h1>
        <p className="text-sm text-slate-400">Receita da plataforma discriminada por estabelecimento.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {presets.map(({ k, l }) => (
            <button key={k} onClick={() => { setRange(k); setCustom(null); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${range===k && !custom ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-slate-800"}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <input type="date" value={custom?.from ?? ""} onChange={(e) => setCustom(c => ({ from: e.target.value, to: c?.to ?? e.target.value }))}
            className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1" />
          <span>até</span>
          <input type="date" value={custom?.to ?? ""} onChange={(e) => setCustom(c => ({ from: c?.from ?? e.target.value, to: e.target.value }))}
            className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <TotalCard label="Pedidos" value={String(data?.totals.orders ?? 0)} />
        <TotalCard label="Vendido (bruto)" value={brl(data?.totals.gross ?? 0)} />
        <TotalCard label="Comissões" value={brl(data?.totals.commission ?? 0)} />
        <TotalCard label="Taxas" value={brl(data?.totals.fees ?? 0)} />
        <TotalCard label="Receita da plataforma" value={brl(data?.totals.platform ?? 0)} highlight />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Estabelecimento</th>
              <th className="px-4 py-3 text-right">Pedidos</th>
              <th className="px-4 py-3 text-right">Valor vendido</th>
              <th className="px-4 py-3 text-right">Comissão</th>
              <th className="px-4 py-3 text-right">Taxas</th>
              <th className="px-4 py-3 text-right">Receita plataforma</th>
              <th className="px-4 py-3 text-right">Saldo do parceiro</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Carregando…</td></tr>}
            {!isLoading && (data?.rows ?? []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-slate-400">Sem dados no período.</td></tr>
            )}
            {(data?.rows ?? []).map(r => (
              <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-slate-400">{r.category ?? "—"} · {r.city ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-right">{r.orders}</td>
                <td className="px-4 py-3 text-right">{brl(r.gross)}</td>
                <td className="px-4 py-3 text-right">{brl(r.commission)}</td>
                <td className="px-4 py-3 text-right">{brl(r.fees)}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary">{brl(r.platform)}</td>
                <td className="px-4 py-3 text-right text-green-400">{brl(r.partnerBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TotalCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-primary/50 bg-primary/10" : "border-slate-800 bg-slate-900"}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
