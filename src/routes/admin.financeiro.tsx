import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformFinance } from "@/lib/superadmin.functions";
import { adminPresetRangeUTC } from "@/lib/admin-finance-contract";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/admin/financeiro")({
  head: () => ({ meta: [{ title: "Admin - Financeiro da Plataforma" }] }),
  component: FinancePage,
});

function preset(key: string) {
  if (key === "today") return adminPresetRangeUTC("today");
  if (key === "week") return adminPresetRangeUTC("week");
  if (key === "year") return adminPresetRangeUTC("year");
  return adminPresetRangeUTC("month");
}

function FinancePage() {
  const [range, setRange] = useState("month");
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const fn = useServerFn(getPlatformFinance);
  const period = custom ?? preset(range);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-finance", range, custom],
    queryFn: () => fn({ data: period }),
  });

  const presets = [
    { k: "today", l: "Hoje" },
    { k: "week", l: "Semana" },
    { k: "month", l: "Mes" },
    { k: "year", l: "Ano" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro da Plataforma</h1>
        <p className="text-sm text-slate-400">Valores financeiros persistidos por estabelecimento.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {presets.map(({ k, l }) => (
            <button
              key={k}
              onClick={() => { setRange(k); setCustom(null); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                range === k && !custom ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="date"
            value={custom?.from ?? ""}
            onChange={(event) => setCustom((current) => ({ from: event.target.value, to: current?.to ?? event.target.value }))}
            className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1"
          />
          <span>ate</span>
          <input
            type="date"
            value={custom?.to ?? ""}
            onChange={(event) => setCustom((current) => ({ from: current?.from ?? event.target.value, to: event.target.value }))}
            className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <TotalCard label="Pedidos" value={String(data?.totals.orders ?? 0)} />
        <TotalCard label="Total cliente" value={brl(data?.totals.customerTotal ?? 0)} />
        <TotalCard label="Taxa plataforma" value={brl(data?.totals.platformFee ?? 0)} />
        <TotalCard label="Receita plataforma" value={brl(data?.totals.platformRevenue ?? 0)} highlight />
        <TotalCard label="Receita realizada" value={brl(data?.totals.realizedPlatformRevenue ?? 0)} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Estabelecimento</th>
              <th className="px-4 py-3 text-right">Pedidos</th>
              <th className="px-4 py-3 text-right">Total cliente</th>
              <th className="px-4 py-3 text-right">Bruto restaurante</th>
              <th className="px-4 py-3 text-right">Taxa plataforma</th>
              <th className="px-4 py-3 text-right">Receita plataforma</th>
              <th className="px-4 py-3 text-right">Receita realizada</th>
              <th className="px-4 py-3 text-right">Liquido parceiro</th>
              <th className="px-4 py-3 text-right">Sem snapshot</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="p-6 text-center text-slate-400">Carregando...</td></tr>}
            {!isLoading && (data?.rows ?? []).length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-slate-400">Sem dados no periodo.</td></tr>
            )}
            {(data?.rows ?? []).map((row) => (
              <tr key={row.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-slate-400">{row.category ?? "-"} / {row.city ?? "-"}</div>
                </td>
                <td className="px-4 py-3 text-right">{row.orders}</td>
                <td className="px-4 py-3 text-right">{brl(row.customerTotal)}</td>
                <td className="px-4 py-3 text-right">{brl(row.restaurantGross)}</td>
                <td className="px-4 py-3 text-right">{brl(row.platformFee)}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary">{brl(row.platformRevenue)}</td>
                <td className="px-4 py-3 text-right">{brl(row.realizedPlatformRevenue)}</td>
                <td className="px-4 py-3 text-right text-green-400">{brl(row.restaurantNet)}</td>
                <td className="px-4 py-3 text-right text-amber-300">{row.missingSnapshotOrders}</td>
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
