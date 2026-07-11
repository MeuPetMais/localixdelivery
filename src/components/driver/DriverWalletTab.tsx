// RC6.7 — Aba Carteira do Entregador (saldo, filtros, gráfico 30d, extrato, export CSV).

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Download, QrCode, FileText, TrendingUp } from "lucide-react";
import { BRL } from "@/lib/driver-wallet";
import {
  filterHistory,
  summarize,
  toCsv,
  downloadCsv,
  type HistoryItem,
  type WalletRange,
  type DailyPoint,
} from "@/lib/driver-wallet-filters";

type Props = {
  earnings: {
    today: number;
    week: number;
    month: number;
    todayCount: number;
    weekCount: number;
    monthCount: number;
    dailySeries?: DailyPoint[];
  };
  history: HistoryItem[];
};

export function DriverWalletTab({ earnings, history }: Props) {
  const [range, setRange] = useState<WalletRange>("today");
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});

  const filtered = useMemo(() => filterHistory(history, range, custom), [history, range, custom]);
  const summary = useMemo(() => summarize(filtered), [filtered]);

  const series = earnings.dailySeries ?? [];
  const maxVal = Math.max(1, ...series.map((s) => s.value));

  const handleExport = () => {
    const csv = toCsv(filtered);
    downloadCsv(`carteira-${range}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="animate-in fade-in space-y-4">
      <h2 className="font-display text-2xl font-extrabold">Carteira</h2>

      {/* Saldo disponível */}
      <Card className="rounded-3xl border-none bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-md">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
          <Wallet className="h-3.5 w-3.5" /> Saldo disponível
        </div>
        <p className="mt-2 font-display text-4xl font-extrabold">{BRL(earnings.today + earnings.week + earnings.month - earnings.week - earnings.month + earnings.week)}</p>
        <p className="mt-1 text-xs opacity-80">Estimativa da semana em curso</p>
      </Card>

      {/* KPIs Hoje / Semana / Mês */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="rounded-2xl border-none p-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hoje</p>
          <p className="mt-1 font-display text-lg font-extrabold">{BRL(earnings.today)}</p>
          <p className="text-[11px] text-muted-foreground">{earnings.todayCount} entrega(s)</p>
        </Card>
        <Card className="rounded-2xl border-none p-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Semana</p>
          <p className="mt-1 font-display text-lg font-extrabold">{BRL(earnings.week)}</p>
          <p className="text-[11px] text-muted-foreground">{earnings.weekCount} entrega(s)</p>
        </Card>
        <Card className="rounded-2xl border-none p-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mês</p>
          <p className="mt-1 font-display text-lg font-extrabold">{BRL(earnings.month)}</p>
          <p className="text-[11px] text-muted-foreground">{earnings.monthCount} entrega(s)</p>
        </Card>
      </div>

      {/* Gráfico 30 dias */}
      <Card className="rounded-2xl border-none p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" /> Últimos 30 dias
        </div>
        {series.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="flex h-32 items-end gap-0.5">
            {series.map((s) => {
              const h = Math.max(2, Math.round((s.value / maxVal) * 100));
              return (
                <div
                  key={s.date}
                  className="group relative flex-1 rounded-t bg-primary/70 hover:bg-primary transition-all"
                  style={{ height: `${h}%` }}
                  title={`${s.date}: ${BRL(s.value)} (${s.count})`}
                />
              );
            })}
          </div>
        )}
      </Card>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {(["today", "week", "month", "custom"] as WalletRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              range === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {r === "today" ? "Hoje" : r === "week" ? "Semana" : r === "month" ? "Mês" : "Personalizado"}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={custom.from ?? ""}
            onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
          />
          <Input
            type="date"
            value={custom.to ?? ""}
            onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
          />
        </div>
      )}

      {/* Resumo do período filtrado */}
      <Card className="rounded-2xl border-none p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="mt-1 font-display text-lg font-extrabold text-emerald-600">{BRL(summary.total)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entregas</p>
            <p className="mt-1 font-display text-lg font-extrabold">{summary.count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ticket médio</p>
            <p className="mt-1 font-display text-lg font-extrabold">{BRL(summary.ticket)}</p>
          </div>
        </div>
      </Card>

      {/* Histórico */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico ({filtered.length})
        </p>
        <Card className="divide-y divide-border/40 rounded-2xl border-none shadow-sm">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma entrega no período.</div>
          )}
          {filtered.map((h) => {
            const dt = new Date(h.delivered_at ?? h.created_at ?? "");
            return (
              <div key={h.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    Pedido {h.order?.order_number ? `#${h.order.order_number}` : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dt.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {h.status === "ENTREGUE" ? "Entregue" : "Cancelada"}
                  </p>
                </div>
                <p className={`font-display text-sm font-extrabold ${h.status === "ENTREGUE" ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {h.status === "ENTREGUE" ? `+ ${BRL(h.earnings)}` : "—"}
                </p>
              </div>
            );
          })}
        </Card>
      </div>

      {/* Ações preparadas (não implementar pagamentos ainda) */}
      <Card className="rounded-2xl border-none p-4 shadow-sm">
        <p className="text-sm font-semibold">Ações da carteira</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pagamentos via PIX e extrato oficial em breve — nesta fase do piloto apenas exportação está ativa.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button variant="outline" className="rounded-2xl" disabled title="Em breve">
            <QrCode className="mr-1 h-4 w-4" /> PIX
          </Button>
          <Button variant="outline" className="rounded-2xl" disabled title="Em breve">
            <FileText className="mr-1 h-4 w-4" /> Extrato
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
        </div>
      </Card>
    </div>
  );
}
