import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Gift, Sparkles, Loader2, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  getMyLoyaltyForRestaurant,
  quoteLoyaltyRedemption,
} from "@/lib/loyalty.functions";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LoyaltyRedeemBlock({
  slug,
  subtotal,
  authenticated,
  onChange,
}: {
  slug: string;
  subtotal: number;
  authenticated: boolean;
  onChange: (v: { points: number; discount: number }) => void;
}) {
  const summaryFn = useServerFn(getMyLoyaltyForRestaurant);
  const quoteFn = useServerFn(quoteLoyaltyRedemption);
  const [points, setPoints] = useState(0);
  const [touched, setTouched] = useState(false);

  const summaryQ = useQuery({
    queryKey: ["loyalty", "summary", slug, authenticated],
    queryFn: () => summaryFn({ data: { slug } }),
    enabled: !!slug && authenticated,
  });

  const quoteQ = useQuery({
    queryKey: ["loyalty", "quote", slug, subtotal, points],
    queryFn: () => quoteFn({ data: { slug, subtotal, points } }),
    enabled: !!slug && authenticated && subtotal > 0 && (summaryQ.data?.active ?? false),
  });

  const maxPoints = quoteQ.data?.maxPoints ?? summaryQ.data?.balance ?? 0;
  const balance = summaryQ.data?.balance ?? 0;
  const minRedeem = summaryQ.data?.settings.min_redeem ?? 100;
  const discount = quoteQ.data?.discount ?? 0;
  const effectivePoints = quoteQ.data?.points ?? 0;

  useEffect(() => {
    onChange({ points: effectivePoints, discount });
  }, [effectivePoints, discount, onChange]);

  // não mostrar bloco se programa não estiver ativo
  if (!authenticated) {
    return (
      <Card className="border-dashed border-amber-300 bg-amber-50/40 animate-in fade-in slide-in-from-bottom-2">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100">
            <Gift className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Programa de Fidelidade</p>
            <p className="text-xs text-muted-foreground">
              <Lock className="inline h-3 w-3 mr-1" />
              Entre na sua conta para usar seus pontos como desconto.
            </p>
          </div>
          <Button asChild size="sm" variant="secondary"><Link to="/cliente">Entrar</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (summaryQ.isLoading) {
    return (
      <Card><CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando fidelidade…
      </CardContent></Card>
    );
  }

  if (!summaryQ.data?.active) return null;
  if (balance < minRedeem) {
    return (
      <Card className="animate-in fade-in slide-in-from-bottom-2">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">⭐ Usar meus pontos</p>
              <p className="text-xs text-muted-foreground">
                Você possui <b>{balance} pontos</b>. Faltam <b>{minRedeem - balance} pontos</b> para utilizar seus benefícios.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }


  const pointsPerReal = summaryQ.data?.settings.points_per_real ?? 0;
  const earnOn = summaryQ.data?.settings.earn_on ?? "delivered";
  const estimatedEarn = Math.floor(subtotal * pointsPerReal);

  return (
    <div className="space-y-3">
      {summaryQ.data?.active && estimatedEarn > 0 && (
        <Card className="border-emerald-300/60 bg-emerald-50/50 dark:bg-emerald-950/20 animate-in fade-in slide-in-from-bottom-2">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Sparkles className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm">
              Você ganhará <b className="text-emerald-700 dark:text-emerald-400">+{estimatedEarn} pontos</b>{" "}
              {earnOn === "delivered"
                ? "quando este pedido for entregue."
                : "após a confirmação do pagamento."}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-2">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <p className="font-semibold text-sm">⭐ Usar meus pontos</p>
          </div>
          <Badge variant="secondary">{balance} pts</Badge>
        </div>
        <div className="text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span>Mínimo p/ resgate:</span><span className="text-right font-medium">{minRedeem} pts</span>
          <span>Máx. neste pedido:</span><span className="text-right font-medium">{maxPoints} pts</span>
          <span>Valor do desconto máx.:</span><span className="text-right font-medium">{brl((maxPoints / (summaryQ.data.settings.points_per_real || 1)))}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant={points === 0 ? "default" : "outline"}
            onClick={() => { setTouched(true); setPoints(0); }}>Não usar</Button>
          <Button size="sm" variant={points === minRedeem ? "default" : "outline"}
            onClick={() => { setTouched(true); setPoints(minRedeem); }}>Mínimo</Button>
          <Button size="sm" variant={points === maxPoints && maxPoints > 0 ? "default" : "outline"}
            onClick={() => { setTouched(true); setPoints(maxPoints); }}>Máximo</Button>
        </div>


        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant={points === 0 ? "default" : "outline"}
            onClick={() => { setTouched(true); setPoints(0); }}>Não usar</Button>
          <Button size="sm" variant={points > 0 && points < maxPoints ? "default" : "outline"}
            onClick={() => { setTouched(true); setPoints(Math.max(minRedeem, Math.floor(maxPoints / 2))); }}>Metade</Button>
          <Button size="sm" variant={points === maxPoints && maxPoints > 0 ? "default" : "outline"}
            onClick={() => { setTouched(true); setPoints(maxPoints); }}>Máximo</Button>
        </div>

        <div className="space-y-1.5">
          <Slider
            value={[points]}
            min={0}
            max={maxPoints}
            step={Math.max(1, Math.floor(minRedeem / 4))}
            onValueChange={(v) => { setTouched(true); setPoints(v[0] ?? 0); }}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{points} pontos</span>
            <span className="font-semibold text-primary">- {brl(discount)}</span>
          </div>
        </div>

        {touched && effectivePoints > 0 && (
          <div className="rounded-md bg-primary text-primary-foreground p-2 text-center text-sm font-medium animate-in fade-in">
            🎁 Você economizou {brl(discount)} usando seus pontos.
          </div>
        )}
        {touched && effectivePoints === 0 && points > 0 && points < minRedeem && (
          <p className="text-xs text-amber-600">Mínimo {minRedeem} pontos por resgate.</p>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
