import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Gift,
  TrendingUp,
  ArrowLeft,
  Loader2,
  Trophy,
  AlertTriangle,
  Wallet,
  Ticket,
  Copy,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { BottomNavSpacer } from "@/components/BottomNav";
import {
  getMyLoyaltyForRestaurant,
  getMyLoyaltyHistory,
  getMyExpiringPoints,
  getRestaurantRewards,
  getRestaurantCoupons,
  type LoyaltyTransaction,
} from "@/lib/loyalty.functions";
import { useRestaurantSession } from "@/contexts/RestaurantSessionContext";

export const Route = createFileRoute("/fidelidade")({
  ssr: false,
  head: () => ({ meta: [{ title: "Minha Carteira — Localix" }] }),
  component: WalletPage,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Filter = "all" | "earn" | "redeem" | "expire" | "bonus";

function WalletPage() {
  const { user, loading } = useCustomerAuth();
  const session = useRestaurantSession();
  const slug = session.session?.restaurantSlug ?? "";
  const summaryFn = useServerFn(getMyLoyaltyForRestaurant);
  const historyFn = useServerFn(getMyLoyaltyHistory);
  const expiringFn = useServerFn(getMyExpiringPoints);
  const rewardsFn = useServerFn(getRestaurantRewards);
  const couponsFn = useServerFn(getRestaurantCoupons);
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
  const expiringQ = useQuery({
    queryKey: ["loyalty", "expiring", slug],
    queryFn: () => expiringFn({ data: { slug } }),
    enabled: !!user && !!slug,
  });
  const rewardsQ = useQuery({
    queryKey: ["loyalty", "rewards", slug],
    queryFn: () => rewardsFn({ data: { slug } }),
    enabled: !!user && !!slug,
  });
  const couponsQ = useQuery({
    queryKey: ["loyalty", "coupons", slug],
    queryFn: () => couponsFn({ data: { slug } }),
    enabled: !!user && !!slug,
  });

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground">Entre para acessar sua carteira.</p>
            <Button asChild>
              <Link to="/cliente">Entrar</Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  const s = summaryQ.data;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-32">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link to="/cliente">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl">Minha Carteira</h1>
        </div>
      </div>

      {summaryQ.isLoading && (
        <Card>
          <CardContent className="p-6 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </CardContent>
        </Card>
      )}

      {s && !s.active && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Este estabelecimento não possui programa de fidelidade ativo.
          </CardContent>
        </Card>
      )}

      {s && s.active && (
        <>
          {/* 1. Saldo + Nível + Próximo nível */}
          <Card className="overflow-hidden border-primary/20">
            <div className="space-y-4 bg-gradient-to-br from-primary/15 via-primary/10 to-transparent p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Saldo em {s.restaurantName}
                  </p>
                  <p className="text-4xl font-bold text-primary">{s.balance}</p>
                  <p className="text-xs text-muted-foreground">pontos disponíveis</p>
                </div>
                {s.level && (
                  <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                    <Trophy className="h-3.5 w-3.5" /> {s.level}
                  </Badge>
                )}
              </div>

              {s.nextLevel ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Próximo nível: <b>{s.nextLevel.name}</b>
                    </span>
                    <span className="font-medium">
                      Faltam {s.nextLevel.remaining} pts
                    </span>
                  </div>
                  <Progress value={Math.round(s.progress * 100)} />
                </div>
              ) : s.level ? (
                <p className="text-xs text-muted-foreground">
                  Você já alcançou o nível máximo. 🎉
                </p>
              ) : null}

              <div className="grid grid-cols-3 gap-3 pt-2 text-center">
                <Stat
                  icon={<Sparkles className="h-4 w-4" />}
                  label="Total ganho"
                  value={String(s.lifetime)}
                />
                <Stat
                  icon={<Gift className="h-4 w-4" />}
                  label="Mín. resgate"
                  value={String(s.settings.min_redeem)}
                />
                <Stat
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Por R$ 1"
                  value={String(s.settings.points_per_real)}
                />
              </div>
            </div>
          </Card>

          {/* Alerta de expiração */}
          {expiringQ.data &&
            expiringQ.data.totalExpiring > 0 &&
            expiringQ.data.next && (
              <Card className="animate-in fade-in slide-in-from-top-2 border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="flex items-start gap-3 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-200">
                      {expiringQ.data.next.points} pontos expiram em{" "}
                      {expiringQ.data.next.days}{" "}
                      {expiringQ.data.next.days === 1 ? "dia" : "dias"}.
                    </p>
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                      Total expirando em até 30 dias:{" "}
                      {expiringQ.data.totalExpiring} pts. Use antes que vençam.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* 4. Como funciona */}
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Info className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Como funciona</p>
                <p className="text-muted-foreground">
                  A cada R$ 1 gasto você ganha{" "}
                  <b>{s.settings.points_per_real}</b>{" "}
                  {s.settings.points_per_real === 1 ? "ponto" : "pontos"}. Os
                  pontos são creditados{" "}
                  {s.settings.earn_on === "delivered"
                    ? "após a entrega do pedido"
                    : "após a confirmação do pagamento"}
                  .
                </p>
                <p className="text-xs text-muted-foreground">
                  Validade: {s.settings.validity_days} dias · Resgate mínimo:{" "}
                  {s.settings.min_redeem} pts · Desconto máximo por pedido:{" "}
                  {s.settings.max_discount_percent}%.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 5. Próximo pedido */}
          <NextOrderCard
            pointsPerReal={s.settings.points_per_real}
            earnOn={s.settings.earn_on}
          />

          {/* 6. Recompensas disponíveis */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h2 className="font-semibold">Recompensas disponíveis</h2>
              </div>
              {rewardsQ.isLoading ? (
                <div className="py-4 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </div>
              ) : (rewardsQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este restaurante ainda não cadastrou recompensas.
                </p>
              ) : (
                <div className="space-y-2">
                  {rewardsQ.data!.map((r) => (
                    <div
                      key={r.name}
                      className={`rounded-lg border p-3 ${
                        r.reached
                          ? "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20"
                          : "border-border/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {r.reached && (
                            <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />
                          )}
                          {r.name}
                        </p>
                        <Badge variant={r.reached ? "default" : "outline"}>
                          {r.minimum_points} pts
                        </Badge>
                      </div>
                      {r.benefits.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 pl-4 text-xs text-muted-foreground">
                          {r.benefits.map((b, i) => (
                            <li key={i} className="list-disc">
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 7. Cupons disponíveis */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Cupons disponíveis</h2>
              </div>
              {couponsQ.isLoading ? (
                <div className="py-4 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </div>
              ) : (couponsQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum cupom ativo no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {couponsQ.data!.map((c) => (
                    <CouponRow key={c.id} code={c.code} discount={c.discount_percent} until={c.valid_until} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 8. Histórico */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="font-semibold">Histórico</h2>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="earn">Ganhos</TabsTrigger>
                  <TabsTrigger value="redeem">Resgates</TabsTrigger>
                  <TabsTrigger value="expire">Expirados</TabsTrigger>
                  <TabsTrigger value="bonus">Bônus</TabsTrigger>
                </TabsList>
              </Tabs>

              {historyQ.isLoading ? (
                <div className="py-6 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </div>
              ) : (historyQ.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma movimentação neste filtro.
                </p>
              ) : (
                <div className="divide-y">
                  {(historyQ.data ?? []).map((tx) => (
                    <HistoryRow key={tx.id} tx={tx} />
                  ))}
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

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-background/60 p-2">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function NextOrderCard({
  pointsPerReal,
  earnOn,
}: {
  pointsPerReal: number;
  earnOn: "paid" | "delivered";
}) {
  // Lê o carrinho persistido pelo cliente para estimar o ganho do próximo pedido.
  let cartTotal = 0;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : parsed?.items ?? [];
        cartTotal = items.reduce(
          (sum: number, it: any) =>
            sum + Number(it.price ?? 0) * Number(it.qty ?? it.quantity ?? 1),
          0,
        );
      }
    } catch {
      cartTotal = 0;
    }
  }
  const estimatedPoints = Math.floor(cartTotal * pointsPerReal);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-0.5 text-sm">
          <p className="font-semibold">Próximo pedido</p>
          {cartTotal > 0 ? (
            <p className="text-muted-foreground">
              Neste pedido você ganhará{" "}
              <b className="text-primary">+{estimatedPoints} pontos</b>{" "}
              {earnOn === "delivered"
                ? "quando ele for entregue."
                : "após a confirmação do pagamento."}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Adicione itens ao carrinho para ver quantos pontos você ganhará.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CouponRow({
  code,
  discount,
  until,
}: {
  code: string;
  discount: number;
  until: string | null;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Cupom copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }
  const untilLabel = until
    ? new Date(until).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-primary">{code}</p>
        <p className="text-xs text-muted-foreground">
          {discount}% de desconto{untilLabel ? ` · até ${untilLabel}` : ""}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={copy}>
        <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
      </Button>
    </div>
  );
}

function HistoryRow({ tx }: { tx: LoyaltyTransaction }) {
  const isPos = tx.points > 0;
  const label =
    tx.type === "EARN"
      ? "Pontos ganhos"
      : tx.type === "REDEEM"
        ? "Resgate"
        : tx.type === "EXPIRE"
          ? "Expiração"
          : tx.type === "BONUS"
            ? "Bônus"
            : tx.type === "ADJUSTMENT"
              ? "Ajuste"
              : tx.type;
  const date = new Date(tx.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.description ?? tx.source ?? ""} · {date}
        </p>
      </div>
      <div className="text-right">
        <p
          className={`text-sm font-semibold ${
            isPos ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {isPos ? "+" : ""}
          {tx.points} pts
        </p>
        {tx.balance_after !== null && (
          <p className="text-[10px] text-muted-foreground">
            saldo {tx.balance_after}
          </p>
        )}
      </div>
    </div>
  );
}
