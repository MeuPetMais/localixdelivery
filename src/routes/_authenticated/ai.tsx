import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Wand2, Users, TrendingUp, TrendingDown, Trophy, Package, DollarSign, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getAiInsights, generateCampaign } from "@/lib/ai.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({ meta: [{ title: "Central de IA — Localix" }] }),
  component: AiCenterPage,
});

type CampaignType = "inativos" | "produto_parado" | "relampago" | "vip" | "cashback" | "custom";

const PRESETS: { type: CampaignType; label: string; emoji: string }[] = [
  { type: "inativos", label: "Recuperar Inativos", emoji: "💌" },
  { type: "produto_parado", label: "Promover Produto Parado", emoji: "📦" },
  { type: "relampago", label: "Campanha Relâmpago", emoji: "⚡" },
  { type: "vip", label: "Cliente VIP", emoji: "👑" },
  { type: "cashback", label: "Cashback", emoji: "💰" },
];

function AiCenterPage() {
  const fetchInsights = useServerFn(getAiInsights);
  const fetchCampaign = useServerFn(generateCampaign);
  const restaurant = useRestaurant();


  const restaurantId = restaurant?.id;

  const insightsQ = useQuery({
    queryKey: ["ai-insights", restaurantId],
    queryFn: () => fetchInsights({ data: { restaurantId: restaurantId! } }),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });

  const [campaign, setCampaign] = useState<Awaited<ReturnType<typeof fetchCampaign>> | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [customBrief, setCustomBrief] = useState("");

  async function runCampaign(type: CampaignType) {
    if (!restaurantId) return;
    setCampaignLoading(true);
    setCampaign(null);
    try {
      const res = await fetchCampaign({
        data: { restaurantId, type, customBrief: type === "custom" ? customBrief : undefined },
      });
      setCampaign(res);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar campanha");
    } finally {
      setCampaignLoading(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  }

  if (!restaurant) {
    return <div className="text-sm text-muted-foreground">Carregando restaurante…</div>;
  }

  const m = insightsQ.data?.metrics;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold">
            <Sparkles className="h-7 w-7 text-primary" /> Central de IA
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Seu consultor de crescimento automatizado.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => insightsQ.refetch()} disabled={insightsQ.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${insightsQ.isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      {/* Relatório executivo */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Relatório Executivo (30 dias)</h2>
        {insightsQ.isLoading || !m ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Analisando seus dados…</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard icon={<DollarSign className="h-4 w-4" />} label="Receita 30d" value={brl(m.revenue30)} delta={m.revenueDelta} />
            <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Ticket médio" value={brl(m.ticket30)} delta={m.ticketDelta} />
            <MetricCard icon={<Users className="h-4 w-4" />} label="Clientes ativos" value={String(m.activeCustomers)} sub={`${m.customersTotal} no total`} />
            <MetricCard icon={<TrendingDown className="h-4 w-4" />} label="Clientes inativos" value={String(m.inactiveCustomers)} sub="30+ dias sem comprar" />
            <MetricCard icon={<Trophy className="h-4 w-4" />} label="Campeão" value={m.topProduct?.name ?? "—"} sub={m.topProduct ? `${m.topProduct.qty} vendidos` : ""} />
            <MetricCard icon={<Package className="h-4 w-4" />} label="Menor saída" value={m.worstProduct?.name ?? "—"} sub={m.worstProduct ? `${m.worstProduct.qty} vendidos` : ""} />
          </div>
        )}
      </section>

      {/* Insights */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Insights Inteligentes</h2>
        <Card className="p-4">
          {insightsQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Gerando insights…</div>
          ) : insightsQ.data?.insights.length ? (
            <ul className="space-y-2">
              {insightsQ.data.insights.map((line, i) => (
                <li key={i} className="rounded-md border bg-card/60 p-3 text-sm leading-relaxed">{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda não há dados suficientes para gerar insights.</p>
          )}
        </Card>
      </section>

      {/* Central de Marketing */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Wand2 className="h-5 w-5 text-primary" /> Central de Marketing</h2>
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.type} variant="outline" size="sm" disabled={campaignLoading} onClick={() => runCampaign(p.type)}>
                <span className="mr-1.5">{p.emoji}</span> {p.label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="Ou descreva sua própria campanha (ex.: divulgar nova pizza de calabresa para o final de semana)…"
              value={customBrief}
              onChange={(e) => setCustomBrief(e.target.value)}
              rows={2}
            />
            <Button onClick={() => runCampaign("custom")} disabled={campaignLoading || customBrief.trim().length < 5} className="bg-gradient-warm">
              {campaignLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Gerar Campanha
            </Button>
          </div>

          {campaign && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold">{campaign.titulo}</h3>
                <Badge variant="secondary">{campaign.cupom.codigo} · {campaign.cupom.desconto}% · {campaign.cupom.validade_dias}d</Badge>
              </div>

              <CampaignBlock label="WhatsApp" text={campaign.whatsapp} onCopy={() => copy(campaign.whatsapp, "Texto WhatsApp")} />
              <CampaignBlock label="Instagram" text={campaign.instagram} onCopy={() => copy(campaign.instagram, "Legenda Instagram")} />
              <CampaignBlock label="Promoção sugerida" text={campaign.promocao} onCopy={() => copy(campaign.promocao, "Promoção")} />

              <p className="text-xs text-muted-foreground">💡 Crie o cupom <strong>{campaign.cupom.codigo}</strong> em Fidelidade para ativar o desconto sugerido.</p>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value, delta, sub }: { icon: React.ReactNode; label: string; value: string; delta?: number; sub?: string }) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
      {typeof delta === "number" && (
        <p className={`mt-0.5 text-xs font-medium ${positive ? "text-emerald-600" : "text-red-600"}`}>
          {positive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs mês anterior
        </p>
      )}
      {sub && !delta && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      {sub && typeof delta === "number" && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function CampaignBlock({ label, text, onCopy }: { label: string; text: string; onCopy: () => void }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <Button size="sm" variant="ghost" onClick={onCopy}><Copy className="mr-1 h-3.5 w-3.5" /> Copiar</Button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </div>
  );
}
