// RC8.0 — Financeiro: fechamento por entregador.
// Read-only. Nenhuma alteração em Orders/Payments/Delivery/Tracking/Queue/Wallet.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Wallet, Users, MapPin, Package, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { getFinancialClosing } from "@/lib/financial-closing.functions";
import { formatBRL, toCsv, type Period } from "@/lib/financial-closing";

export const Route = createFileRoute("/_authenticated/financeiro-motoboys")({
  head: () => ({ meta: [
    { title: "Financeiro — Entregadores | Localix" },
    { name: "description", content: "Fechamento financeiro dos entregadores por período." },
  ] }),
  component: FinancialDriversPage,
});

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week",  label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "custom", label: "Personalizado" },
];

function FinancialDriversPage() {
  const restaurant = useRestaurant();
  const fetch = useServerFn(getFinancialClosing);
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["financial-closing", restaurant.id, period, from, to],
    queryFn: () => fetch({ data: {
      restaurantId: restaurant.id, period,
      from: period === "custom" ? from || undefined : undefined,
      to:   period === "custom" ? to   || undefined : undefined,
    } }),
    enabled: !!restaurant.id,
  });

  const list = data?.drivers ?? [];
  const t = data?.totals ?? { deliveries: 0, distance_km: 0, earnings: 0 };

  const periodLabel = useMemo(() => PERIODS.find((p) => p.id === period)?.label ?? "", [period]);

  function handleCsv() {
    const csv = "\uFEFF" + toCsv(list);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fechamento-entregadores-${period}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function handlePdf() {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    const rows = list.map((d) => `
      <tr>
        <td>${escapeHtml(d.name)}</td>
        <td style="text-align:right">${d.deliveries}</td>
        <td style="text-align:right">${d.distance_km.toFixed(2)}</td>
        <td style="text-align:right">${formatBRL(d.earnings)}</td>
      </tr>`).join("");
    w.document.write(`
      <!doctype html><html><head><meta charset="utf-8" />
      <title>Fechamento Entregadores — ${escapeHtml(periodLabel)}</title>
      <style>
        body{font-family:system-ui,sans-serif;margin:32px;color:#111}
        h1{font-size:20px;margin:0 0 8px} .muted{color:#666;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left}
        tfoot td{font-weight:600;border-top:2px solid #111}
      </style></head><body>
      <h1>Fechamento de Entregadores</h1>
      <div class="muted">${escapeHtml(restaurant.name ?? "")} • ${escapeHtml(periodLabel)} • ${new Date().toLocaleString("pt-BR")}</div>
      <table>
        <thead><tr><th>Entregador</th><th style="text-align:right">Entregas</th><th style="text-align:right">KM</th><th style="text-align:right">Ganhos</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#888">Sem entregas no período</td></tr>`}</tbody>
        <tfoot><tr>
          <td>TOTAL</td>
          <td style="text-align:right">${t.deliveries}</td>
          <td style="text-align:right">${t.distance_km.toFixed(2)}</td>
          <td style="text-align:right">${formatBRL(t.earnings)}</td>
        </tr></tfoot>
      </table>
      <script>window.onload=()=>window.print();</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 text-primary p-2"><Wallet className="h-5 w-5" /></div>
        <div>
          <h1 className="text-xl font-semibold">Financeiro — Entregadores</h1>
          <p className="text-sm text-muted-foreground">Fechamento por período. Exporte para PDF ou Excel e prepare o repasse via PIX.</p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.id}
            variant={period === p.id ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p.id)}
          >{p.label}</Button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
            <span className="text-muted-foreground text-sm">até</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCsv} disabled={!list.length}>
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handlePdf} disabled={!list.length}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi icon={<Users className="h-4 w-4" />} label="Entregadores ativos" value={list.filter((d) => d.deliveries > 0).length.toString()} />
        <Kpi icon={<Package className="h-4 w-4" />} label="Entregas" value={t.deliveries.toString()} />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Total a repassar" value={formatBRL(t.earnings)} highlight />
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-medium">Ganhos por entregador</h2>
          <Badge variant="secondary">{periodLabel}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Entregador</th>
                <th className="text-right px-4 py-2">Entregas</th>
                <th className="text-right px-4 py-2"><MapPin className="inline h-3.5 w-3.5" /> KM</th>
                <th className="text-right px-4 py-2">Ganhos</th>
                <th className="text-right px-4 py-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>Carregando…</td></tr>
              )}
              {!isLoading && list.length === 0 && (
                <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>Sem entregadores cadastrados.</td></tr>
              )}
              {list.map((d) => (
                <tr key={d.driver_id} className="border-t">
                  <td className="px-4 py-2 flex items-center gap-2">
                    {d.photo_url
                      ? <img src={d.photo_url} alt={d.name} className="h-7 w-7 rounded-full object-cover" />
                      : <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs">{d.name.slice(0,1)}</div>}
                    <span>{d.name}</span>
                  </td>
                  <td className="px-4 py-2 text-right">{d.deliveries}</td>
                  <td className="px-4 py-2 text-right">{d.distance_km.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatBRL(d.earnings)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="outline" disabled title="Em breve">PIX</Button>
                  </td>
                </tr>
              ))}
            </tbody>
            {list.length > 0 && (
              <tfoot className="bg-muted/30">
                <tr className="border-t">
                  <td className="px-4 py-2 font-medium">TOTAL</td>
                  <td className="px-4 py-2 text-right font-medium">{t.deliveries}</td>
                  <td className="px-4 py-2 text-right font-medium">{t.distance_km.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatBRL(t.earnings)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <Card className="p-4 flex items-start gap-3 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5" />
        <div>
          Pagamento automático via PIX ainda não está habilitado. Use os botões
          <strong> Excel </strong> ou <strong> PDF </strong> para gerar o extrato e realizar o repasse manualmente.
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={`p-4 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </Card>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c] as string));
}
