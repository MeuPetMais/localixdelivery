import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gift, Sparkles, Trophy, Truck, Package, Ticket, Coins, Target } from "lucide-react";
import { getMyInProgressBenefits, type InProgressBenefit } from "@/lib/loyalty.functions";

/**
 * Bloco puramente visual de benefícios no Checkout.
 * Reutiliza integralmente `getMyInProgressBenefits` — não altera regras,
 * PricingEngine, Services nem RPCs. Apenas mostra:
 *  - Benefícios já desbloqueados (com CTA "Ver na Carteira").
 *  - Benefício mais próximo, indicando o quanto falta.
 */

function iconFor(kind: string | null) {
  switch (kind) {
    case "FREE_DELIVERY":
      return <Truck className="h-4 w-4" />;
    case "FREE_PRODUCT":
    case "GIFT":
      return <Package className="h-4 w-4" />;
    case "COUPON":
    case "DISCOUNT":
      return <Ticket className="h-4 w-4" />;
    case "CASHBACK":
      return <Coins className="h-4 w-4" />;
    default:
      return <Gift className="h-4 w-4" />;
  }
}

function formatRemaining(b: InProgressBenefit): string {
  if (b.unit === "R$") return `Faltam R$ ${b.remaining.toFixed(2)}`;
  const label = b.unit === "pts"
    ? (b.remaining === 1 ? "ponto" : "pontos")
    : b.unit === "pedidos"
      ? (b.remaining === 1 ? "pedido" : "pedidos")
      : (b.trigger_product_name || (b.remaining === 1 ? "produto" : "produtos"));
  return `Faltam ${b.remaining} ${label}`;
}

export function LoyaltyBenefitsBlock({
  slug,
  authenticated,
}: {
  slug: string;
  authenticated: boolean;
}) {
  const benefitsFn = useServerFn(getMyInProgressBenefits);
  const q = useQuery({
    queryKey: ["loyalty", "benefits", slug, authenticated],
    queryFn: () => benefitsFn({ data: { slug } }),
    enabled: !!slug && authenticated,
  });

  const { unlocked, next } = useMemo(() => {
    const list = q.data ?? [];
    const unlocked = list.filter((b) => b.unlocked);
    const pending = list.filter((b) => !b.unlocked).sort((a, b) => b.ratio - a.ratio);
    return { unlocked, next: pending[0] ?? null };
  }, [q.data]);

  if (!authenticated) return null;
  if (q.isLoading) return null;
  if (unlocked.length === 0 && !next) return null;

  if (unlocked.length > 0) {
    return (
      <Card className="border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/20 animate-in fade-in slide-in-from-bottom-2">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-emerald-600" />
              <p className="font-semibold text-sm">🎉 Você possui benefícios disponíveis</p>
            </div>
            <Badge variant="secondary">{unlocked.length}</Badge>
          </div>
          <div className="space-y-2">
            {unlocked.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-lg border border-emerald-200/70 bg-background/60 p-2.5"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
                  {iconFor(b.ui_kind)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.reward_label}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.name}</p>
                </div>
                <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600">Desbloqueado</Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Aplique seus pontos abaixo. Recompensas em produto, frete grátis, cupom e cashback ficam disponíveis na sua Carteira.
          </p>
          <Button asChild size="sm" variant="secondary" className="w-full">
            <Link to="/fidelidade">Ver na Carteira</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Incentivo — nada desbloqueado ainda, mostrar o mais próximo
  const pct = Math.round((next?.ratio ?? 0) * 100);
  return (
    <Card className="border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-2">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="font-semibold text-sm">Você está quase lá!</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            {iconFor(next!.ui_kind)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">✨ {formatRemaining(next!)}</p>
            <p className="truncate text-xs text-muted-foreground">
              para desbloquear: <b>{next!.reward_label}</b>
            </p>
          </div>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Target className="h-3 w-3" /> {next!.name}
          </span>
          <span className="tabular-nums">
            {next!.unit === "R$"
              ? `R$ ${next!.progress.toFixed(2)} / R$ ${next!.target.toFixed(2)}`
              : `${next!.progress} / ${next!.target} ${next!.unit}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
