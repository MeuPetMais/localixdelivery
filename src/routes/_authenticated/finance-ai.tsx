import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, RefreshCw, TrendingUp, DollarSign, Trophy, ArrowDown, FileBarChart } from "lucide-react";
import { getFinancialIntelligence } from "@/lib/finance-ai.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finance-ai")({
  head: () => ({ meta: [{ title: "Inteligência Financeira — Localix" }] }),
  component: FinanceAiPage,
});

function FinanceAiPage() {
  const run = useServerFn(getFinancialIntelligence);
  const [taxRate, setTaxRate] = useState(6);
  const restaurant = useRestaurant();


  const restaurantId = restaurant?.id;

  const q = useQuery({
    queryKey: ["finance-ai", restaurantId, taxRate],
    queryFn: () => run({ data: { restaurantId: restaurantId!, taxRate } }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });

  if (!restaurant) return <div className="text-sm text-muted-foreground">Carregando restaurante…</div>;

  const d = q.data;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold">
            <Brain className="h-7 w-7 text-primary" /> Inteligência Financeira
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Margem, DRE e insights de lucro com IA.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Alíquota imposto (%)</Label>
            <Input type="number" min={0} max={60} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} className="w-24" />
          </div>
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </header>

      {q.isLoading || !d ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Analisando finanças…</div>
      ) : (
        <>
          {/* Relatório executivo */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Relatório Executivo (30 dias)</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard icon={<DollarSign className="h-4 w-4" />} label="Faturamento" value={brl(d.executive.revenue30)} delta={d.executive.revenueDelta} />
              <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Lucro líquido" value={brl(d.executive.netProfit)} />
              <MetricCard icon={<FileBarChart className="h-4 w-4" />} label="Ticket médio" value={brl(d.executive.ticket30)} />
              <MetricCard icon={<Trophy className="h-4 w-4" />} label="Mais lucrativo" value={d.executive.mostProfitable?.name ?? "—"} sub={d.executive.mostProfitable ? brl(d.executive.mostProfitable.profit) : ""} />
              <MetricCard icon={<ArrowDown className="h-4 w-4" />} label="Menos lucrativo" value={d.executive.leastProfitable?.name ?? "—"} sub={d.executive.leastProfitable ? brl(d.executive.leastProfitable.profit) : ""} />
              <MetricCard icon={<Trophy className="h-4 w-4" />} label="Categoria top" value={d.executive.topCategory?.name ?? "—"} sub={d.executive.topCategory ? brl(d.executive.topCategory.profit) : ""} />
            </div>
          </section>

          {/* Insights IA */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Insights Inteligentes</h2>
            <Card className="p-4">
              {d.insights.length ? (
                <ul className="space-y-2">
                  {d.insights.map((line, i) => (
                    <li key={i} className="rounded-md border bg-card/60 p-3 text-sm leading-relaxed">{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sem insights — adicione vendas, fichas técnicas e despesas para gerar análise.</p>
              )}
            </Card>
          </section>

          {/* DRE */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">DRE Simplificado</h2>
            <Card className="p-4">
              <div className="space-y-1 text-sm">
                <DreLine label="Receita Bruta" value={d.dre.receitaBruta} bold />
                <DreLine label="(-) Custos dos Produtos (CMV)" value={-d.dre.cogs} />
                {d.dre.outrasReceitas > 0 && <DreLine label="(+) Outras Receitas" value={d.dre.outrasReceitas} />}
                <DreLine label="= Lucro Bruto" value={d.dre.lucroBruto} highlight />
                <DreLine label="(-) Despesas Operacionais" value={-d.dre.despesasOperacionais} />
                <DreLine label="= Lucro Operacional" value={d.dre.lucroOperacional} highlight />
                <DreLine label={`(-) Impostos (${d.dre.taxRate}%)`} value={-d.dre.impostos} />
                <DreLine label="= Lucro Líquido" value={d.dre.lucroLiquido} bold highlight />
              </div>
            </Card>
          </section>

          {/* Margem por produto */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Margem por Produto</h2>
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">Preço</th>
                      <th className="px-4 py-3">Custo</th>
                      <th className="px-4 py-3">Lucro bruto</th>
                      <th className="px-4 py-3">Margem</th>
                      <th className="px-4 py-3">Vendidos 30d</th>
                      <th className="px-4 py-3">Lucro total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.products.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sem produtos cadastrados.</td></tr>
                    )}
                    {d.products.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3">{brl(p.price)}</td>
                        <td className="px-4 py-3">{p.cost > 0 ? brl(p.cost) : <span className="text-xs text-muted-foreground">sem ficha</span>}</td>
                        <td className="px-4 py-3">{brl(p.gross)}</td>
                        <td className="px-4 py-3"><MarginBadge margin={p.margin} hasCost={p.cost > 0} /></td>
                        <td className="px-4 py-3">{p.qty}</td>
                        <td className="px-4 py-3 font-semibold">{brl(p.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {d.staleIngredients.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold">Estoque Parado (45+ dias)</h2>
              <Card className="p-4">
                <ul className="space-y-1 text-sm">
                  {d.staleIngredients.map((s) => (
                    <li key={s.name} className="flex justify-between border-b py-1.5 last:border-0">
                      <span>{s.name}</span>
                      <span className="text-muted-foreground">{s.stock} em estoque</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, delta, sub }: { icon: React.ReactNode; label: string; value: string; delta?: number; sub?: string }) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
      {typeof delta === "number" && delta !== 0 && (
        <p className={`mt-0.5 text-xs font-medium ${positive ? "text-emerald-600" : "text-red-600"}`}>
          {positive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs período anterior
        </p>
      )}
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function DreLine({ label, value, bold, highlight }: { label: string; value: number; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${highlight ? "border-t" : ""} ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className={value < 0 ? "text-red-600" : highlight ? "text-emerald-700" : ""}>{brl(value)}</span>
    </div>
  );
}

function MarginBadge({ margin, hasCost }: { margin: number; hasCost: boolean }) {
  if (!hasCost) return <span className="text-xs text-muted-foreground">—</span>;
  if (margin >= 50) return <Badge className="bg-emerald-500 hover:bg-emerald-600">{margin.toFixed(0)}%</Badge>;
  if (margin >= 25) return <Badge className="bg-amber-500 hover:bg-amber-600">{margin.toFixed(0)}%</Badge>;
  return <Badge variant="destructive">{margin.toFixed(0)}%</Badge>;
}
