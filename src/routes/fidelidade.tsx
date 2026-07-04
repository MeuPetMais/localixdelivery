import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Gift, TrendingUp, ArrowLeft, Loader2, Trophy, AlertTriangle } from "lucide-react";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { BottomNavSpacer } from "@/components/BottomNav";
import {
  getMyLoyaltyForRestaurant,
  getMyLoyaltyHistory,
  getMyExpiringPoints,
  type LoyaltyTransaction,
} from "@/lib/loyalty.functions";
import { useRestaurantSession } from "@/contexts/RestaurantSessionContext";

export const Route = createFileRoute("/fidelidade")({
  ssr: false,
  head: () => ({ meta: [{ title: "Central de Fidelidade — Localix" }] }),
  component: FidelidadePage,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Filter = "all" | "earn" | "redeem" | "expire" | "bonus";

function FidelidadePage() {
  const { user, loading } = useCustomerAuth();
  const session = useRestaurantSession();
  const slug = session.session?.restaurantSlug ?? "";
  const summaryFn = useServerFn(getMyLoyaltyForRestaurant);
  const historyFn = useServerFn(getMyLoyaltyHistory);
  const [filter, setFilter] = useState<Filter>("all");

  const summaryQ = useQuery({
    queryKey: ["loyalty", "summary", slug],
    queryFn: () => summaryFn({ data: { slug } }),
    enabled: !!user && !!slug,
  });

  const historyQ = useQuery({
    queryKey: ["loyalty", "history", slug, filter],
    queryFn: () => historyFn({ data: { slug, filter } }),
    enabled: !!user && !!slug,
  });

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground">Entre para acessar seus pontos.</p>
            <Button asChild><Link to="/cliente">Entrar</Link></Button>
          </div>
        )}
      </div>
    );
  }

  const s = summaryQ.data;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-32">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link to="/cliente"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <h1 className="font-display text-2xl">Central de Fidelidade</h1>
      </div>

      {summaryQ.isLoading && <Card><CardContent className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></CardContent></Card>}

      {s && !s.active && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">
          Este estabelecimento não possui programa de fidelidade ativo.
        </CardContent></Card>
      )}

      {s && s.active && (
        <>
          {/* Card principal saldo + nível */}
          <Card className="overflow-hidden border-primary/20">
            <div className="bg-gradient-to-br from-primary/15 via-primary/10 to-transparent p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo em {s.restaurantName}</p>
                  <p className="text-4xl font-bold text-primary">{s.balance}</p>
                  <p className="text-xs text-muted-foreground">pontos disponíveis</p>
                </div>
                {s.level && (
                  <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white">
                    <Trophy className="h-3.5 w-3.5" /> {s.level}
                  </Badge>
                )}
              </div>
              {s.nextLevel && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Próximo nível: <b>{s.nextLevel.name}</b></span>
                    <span className="font-medium">Faltam {s.nextLevel.remaining} pts</span>
                  </div>
                  <Progress value={Math.round(s.progress * 100)} />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 text-center pt-2">
                <Stat icon={<Sparkles className="h-4 w-4" />} label="Total ganho" value={String(s.lifetime)} />
                <Stat icon={<Gift className="h-4 w-4" />} label="Mín. resgate" value={String(s.settings.min_redeem)} />
                <Stat icon={<TrendingUp className="h-4 w-4" />} label="Por R$ 1" value={String(s.settings.points_per_real)} />
              </div>
            </div>
          </Card>

          {/* Histórico */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Histórico</h2>
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="earn">Ganhos</TabsTrigger>
                  <TabsTrigger value="redeem">Resgates</TabsTrigger>
                  <TabsTrigger value="expire">Expirados</TabsTrigger>
                  <TabsTrigger value="bonus">Bônus</TabsTrigger>
                </TabsList>
              </Tabs>

              {historyQ.isLoading ? (
                <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
              ) : (historyQ.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma movimentação neste filtro.</p>
              ) : (
                <div className="divide-y">
                  {(historyQ.data ?? []).map((tx) => <HistoryRow key={tx.id} tx={tx} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <BottomNavSpacer />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/60 p-2">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}</div>
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function HistoryRow({ tx }: { tx: LoyaltyTransaction }) {
  const isPos = tx.points > 0;
  const label =
    tx.type === "EARN" ? "Pontos ganhos"
      : tx.type === "REDEEM" ? "Resgate"
      : tx.type === "EXPIRE" ? "Expiração"
      : tx.type === "BONUS" ? "Bônus"
      : tx.type === "ADJUSTMENT" ? "Ajuste" : tx.type;
  const date = new Date(tx.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">
          {tx.description ?? tx.source ?? ""} · {date}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${isPos ? "text-emerald-600" : "text-rose-600"}`}>
          {isPos ? "+" : ""}{tx.points} pts
        </p>
        {tx.balance_after !== null && (
          <p className="text-[10px] text-muted-foreground">saldo {tx.balance_after}</p>
        )}
      </div>
    </div>
  );
}
