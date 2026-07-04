import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sparkles,
  Gift,
  ArrowLeft,
  Loader2,
  Trophy,
  AlertTriangle,
  Wallet,
  Ticket,
  Copy,
  Star,
  Package,
  Truck,
  Coins,
  Hourglass,
  Undo2,
  PartyPopper,
  Utensils,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
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
  getMyInProgressBenefits,
  type LoyaltyTransaction,
  type InProgressBenefit,
} from "@/lib/loyalty.functions";
import { useRestaurantSession } from "@/contexts/RestaurantSessionContext";

export const Route = createFileRoute("/fidelidade")({
  ssr: false,
  head: () => ({ meta: [{ title: "Minha Carteira — Localix" }] }),
  component: WalletPage,
});


type Filter = "all" | "earn" | "redeem" | "expire" | "bonus";

// -------- Utils --------
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function guessRewardIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("frete")) return <Truck className="h-4 w-4" />;
  if (n.includes("cashback") || n.includes("desconto") || n.includes("cupom"))
    return <Ticket className="h-4 w-4" />;
  if (n.includes("brinde") || n.includes("produto") || n.includes("hambúrguer") || n.includes("pizza") || n.includes("bebida"))
    return <Package className="h-4 w-4" />;
  return <Gift className="h-4 w-4" />;
}

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

  const s = summaryQ.data;
  const rewards = rewardsQ.data ?? [];
  const coupons = couponsQ.data ?? [];

  // Próxima recompensa alcançável (menor minimum_points > balance)
  const nextReward = useMemo(() => {
    if (!s) return null;
    const sorted = [...rewards].sort((a, b) => a.minimum_points - b.minimum_points);
    return sorted.find((r) => r.minimum_points > s.balance) ?? null;
  }, [rewards, s]);

  const availableRewards = useMemo(
    () => rewards.filter((r) => s && r.minimum_points <= s.balance),
    [rewards, s],
  );

  if (loading || !user) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
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


  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-32">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar">
          <Link to="/cliente">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <Wallet className="h-6 w-6 shrink-0 text-primary" />
          <h1 className="truncate font-display text-2xl">Minha Carteira</h1>
        </div>
      </div>

      {summaryQ.isLoading && <WalletSkeleton />}

      {s && !s.active && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Este estabelecimento não possui programa de fidelidade ativo.
          </CardContent>
        </Card>
      )}

      {s && s.active && (
        <>
          {/* 1. CARD PRINCIPAL */}
          <BalanceHero
            balance={s.balance}
            restaurantName={s.restaurantName}
            level={s.level}
            minRedeem={s.settings.min_redeem}
            availableRewards={availableRewards}
          />

          {/* 2. BARRA DE PROGRESSO */}
          <ProgressCard summary={s} nextReward={nextReward} />

          {/* Alerta de expiração */}
          {expiringQ.data &&
            expiringQ.data.totalExpiring > 0 &&
            expiringQ.data.next && (
              <Card className="animate-in fade-in slide-in-from-top-2 border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20">
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
                      {expiringQ.data.totalExpiring} pts.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* 3. PRÓXIMO PEDIDO */}
          <NextOrderCard
            pointsPerReal={s.settings.points_per_real}
            earnOn={s.settings.earn_on}
            slug={slug}
          />

          {/* 4. COMO FUNCIONA */}
          <HowItWorks
            pointsPerReal={s.settings.points_per_real}
            earnOn={s.settings.earn_on}
            minRedeem={s.settings.min_redeem}
            validityDays={s.settings.validity_days}
          />

          {/* 5. RECOMPENSAS */}
          <SectionCard
            icon={<Trophy className="h-5 w-5 text-amber-500" />}
            title="Recompensas disponíveis"
          >
            {rewardsQ.isLoading ? (
              <SkeletonRows />
            ) : rewards.length === 0 ? (
              <EmptyState
                emoji="🎁"
                title="Ainda não existem recompensas."
                subtitle="Continue comprando. Novas recompensas aparecerão aqui."
              />
            ) : (
              <div className="space-y-2">
                {rewards.map((r) => {
                  const reached = s.balance >= r.minimum_points;
                  return (
                    <div
                      key={r.name}
                      className={`animate-fade-in rounded-lg border p-3 transition-colors ${
                        reached
                          ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                              reached
                                ? "bg-emerald-500/15 text-emerald-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {guessRewardIcon(r.name)}
                          </span>
                          <p className="truncate text-sm font-medium">{r.name}</p>
                        </div>
                        <Badge variant={reached ? "default" : "outline"} className="shrink-0">
                          {r.minimum_points} pts
                        </Badge>
                      </div>
                      {r.benefits.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 pl-10 text-xs text-muted-foreground">
                          {r.benefits.map((b, i) => (
                            <li key={i} className="list-disc">
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* 6. CUPONS */}
          <SectionCard
            icon={<Ticket className="h-5 w-5 text-primary" />}
            title="Cupons disponíveis"
          >
            {couponsQ.isLoading ? (
              <SkeletonRows />
            ) : coupons.length === 0 ? (
              <EmptyState
                emoji="🏷️"
                title="Você ainda não possui cupons."
                subtitle="Acompanhe campanhas e promoções para não perder nada."
              />
            ) : (
              <div className="space-y-2">
                {coupons.map((c) => (
                  <CouponRow
                    key={c.id}
                    code={c.code}
                    discount={c.discount_percent}
                    until={c.valid_until}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* 7. HISTÓRICO */}
          <SectionCard
            icon={<Clock className="h-5 w-5 text-muted-foreground" />}
            title="Histórico"
          >
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
              <SkeletonRows />
            ) : (
              (() => {
                const visible = (historyQ.data ?? []).filter(isCustomerFacing);
                if (visible.length === 0) {
                  return (
                    <EmptyState
                      emoji="✨"
                      title="Nada por aqui ainda."
                      subtitle="Suas movimentações aparecerão nesta lista."
                    />
                  );
                }
                return (
                  <div className="divide-y">
                    {visible.map((tx) => (
                      <HistoryRow key={tx.id} tx={tx} />
                    ))}
                  </div>
                );
              })()
            )}
          </SectionCard>

          {/* 9. CTA FINAL */}
          <FinalCta slug={slug} />
        </>
      )}

      <BottomNavSpacer />
    </div>
  );
}

// -------- Balance Hero --------
function BalanceHero({
  balance,
  restaurantName,
  level,
  minRedeem,
  availableRewards,
}: {
  balance: number;
  restaurantName: string;
  level: string | null;
  minRedeem: number;
  availableRewards: Array<{ name: string; minimum_points: number }>;
}) {
  const animated = useCountUp(balance);
  const canRedeem = balance >= minRedeem;
  return (
    <Card className="animate-fade-in overflow-hidden border-primary/20">
      <div className="space-y-4 bg-gradient-to-br from-primary/15 via-primary/10 to-transparent p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Saldo em {restaurantName}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <Star className="h-6 w-6 shrink-0 fill-amber-400 text-amber-400" />
              <p className="text-4xl font-bold tabular-nums text-primary">{animated}</p>
              <span className="text-sm text-muted-foreground">pontos</span>
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">
              {canRedeem
                ? "Você já pode trocar por benefícios."
                : "Continue comprando para desbloquear novas recompensas."}
            </p>
          </div>
          {level && (
            <Badge className="shrink-0 gap-1 bg-amber-500 text-white hover:bg-amber-500">
              <Trophy className="h-3.5 w-3.5" /> {level}
            </Badge>
          )}
        </div>

        {availableRewards.length > 0 && (
          <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/60 p-3 dark:bg-emerald-950/20">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              <Gift className="h-4 w-4" /> Você já pode resgatar:
            </p>
            <ul className="space-y-0.5 pl-6 text-sm text-emerald-900/90 dark:text-emerald-100/90">
              {availableRewards.slice(0, 4).map((r) => (
                <li key={r.name} className="list-disc">
                  {r.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

// -------- Progress Card --------
function ProgressCard({
  summary,
  nextReward,
}: {
  summary: {
    balance: number;
    level: string | null;
    nextLevel: { name: string; minimum_points: number; remaining: number } | null;
    progress: number;
  };
  nextReward: { name: string; minimum_points: number } | null;
}) {
  // Prioriza próxima recompensa cadastrada; fallback para próximo nível
  if (nextReward) {
    const remaining = Math.max(0, nextReward.minimum_points - summary.balance);
    const pct = Math.min(
      100,
      Math.round((summary.balance / nextReward.minimum_points) * 100),
    );
    return (
      <Card className="animate-fade-in">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium tabular-nums">{summary.balance} pts</span>
            <span className="text-muted-foreground">
              {nextReward.minimum_points} pts
            </span>
          </div>
          <Progress value={pct} className="h-3" />
          <p className="text-sm">
            Faltam <b className="text-primary tabular-nums">{remaining} pontos</b> para
            desbloquear{" "}
            <span className="inline-flex items-center gap-1 font-medium">
              <Gift className="h-4 w-4 text-primary" /> {nextReward.name}
            </span>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (summary.nextLevel) {
    return (
      <Card className="animate-fade-in">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Nível atual: <b className="text-foreground">{summary.level ?? "—"}</b>
            </span>
            <span className="text-muted-foreground">{summary.nextLevel.name}</span>
          </div>
          <Progress value={Math.round(summary.progress * 100)} className="h-3" />
          <p className="text-sm">
            Faltam{" "}
            <b className="text-primary tabular-nums">
              {summary.nextLevel.remaining} pontos
            </b>{" "}
            para chegar ao nível <b>{summary.nextLevel.name}</b>.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (summary.level) {
    return (
      <Card className="animate-fade-in border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20">
        <CardContent className="p-4 text-sm text-amber-900 dark:text-amber-200">
          🎉 Você alcançou o nível máximo. Aproveite todos os seus benefícios!
        </CardContent>
      </Card>
    );
  }
  return null;
}

// -------- Next Order --------
function NextOrderCard({
  pointsPerReal,
  earnOn,
  slug,
}: {
  pointsPerReal: number;
  earnOn: "paid" | "delivered";
  slug: string;
}) {
  let cartTotal = 0;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : (parsed?.items ?? []);
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

  if (cartTotal <= 0) {
    return (
      <Card className="animate-fade-in border-dashed">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted text-2xl">
            🛒
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Faça um pedido</p>
            <p className="text-xs text-muted-foreground">
              e descubra quantos pontos irá ganhar.
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/$slug" params={{ slug }}>
              Ver cardápio
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in border-primary/30 bg-primary/5">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Star className="h-6 w-6 fill-current" />
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Neste pedido você ganhará</p>
          <p className="text-2xl font-bold tabular-nums text-primary">
            +{estimatedPoints} pontos
          </p>
          <p className="text-xs text-muted-foreground">
            {earnOn === "delivered"
              ? "creditados assim que o pedido for entregue."
              : "creditados após a confirmação do pagamento."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// -------- How it works --------
function HowItWorks({
  pointsPerReal,
  earnOn,
  minRedeem,
  validityDays,
}: {
  pointsPerReal: number;
  earnOn: "paid" | "delivered";
  minRedeem: number;
  validityDays: number;
}) {
  const items = [
    {
      icon: <Star className="h-5 w-5 fill-amber-400 text-amber-400" />,
      title: `A cada R$ 1 gasto`,
      desc: `você ganha ${pointsPerReal} ${pointsPerReal === 1 ? "ponto" : "pontos"}.`,
    },
    {
      icon: <Package className="h-5 w-5 text-primary" />,
      title: "Créditos automáticos",
      desc:
        earnOn === "delivered"
          ? "pontos creditados após a entrega do pedido."
          : "pontos creditados após a confirmação do pagamento.",
    },
    {
      icon: <Gift className="h-5 w-5 text-emerald-600" />,
      title: "Resgate mínimo",
      desc: `${minRedeem} pontos para começar a trocar.`,
    },
    {
      icon: <Hourglass className="h-5 w-5 text-amber-600" />,
      title: "Validade",
      desc: `${validityDays} dias após ganhar.`,
    },
  ];
  return (
    <SectionCard icon={<Sparkles className="h-5 w-5 text-primary" />} title="Como funciona">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((it, i) => (
          <div
            key={i}
            className="animate-fade-in flex items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted">
              {it.icon}
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-semibold leading-tight">{it.title}</p>
              <p className="text-xs text-muted-foreground">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// -------- Section wrapper --------
function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="animate-fade-in">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-semibold">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// -------- Empty state --------
function EmptyState({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {subtitle && (
        <p className="max-w-sm text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

// -------- Coupon Row --------
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
    <div className="animate-fade-in flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 transition-transform active:scale-[0.99]">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-semibold text-primary">
          {code}
        </p>
        <p className="text-xs text-muted-foreground">
          {discount}% de desconto{untilLabel ? ` · até ${untilLabel}` : ""}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
        <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
      </Button>
    </div>
  );
}

// -------- History --------
const TECHNICAL_PATTERNS = /(backfill|migration|migração|customer_points|reference_id|adjustment|source|uuid|rpc|_id\b)/i;

function isCustomerFacing(tx: LoyaltyTransaction): boolean {
  const source = (tx.source ?? "").toLowerCase();
  const desc = (tx.description ?? "").toLowerCase();
  if (source.includes("backfill") || source.includes("migration") || source.includes("migração"))
    return false;
  if (desc.includes("backfill") || desc.includes("migration")) return false;
  return true;
}

function friendlyDescription(tx: LoyaltyTransaction): string | null {
  const desc = tx.description;
  if (!desc) return null;
  if (TECHNICAL_PATTERNS.test(desc)) return null;
  return desc;
}

function HistoryRow({ tx }: { tx: LoyaltyTransaction }) {
  const isPos = tx.points > 0;
  const meta = (() => {
    switch (tx.type) {
      case "EARN":
        return {
          label: "Você ganhou pontos",
          icon: <Star className="h-4 w-4 fill-amber-400 text-amber-400" />,
          bg: "bg-amber-500/10",
        };
      case "REDEEM":
        return {
          label: "Resgate realizado",
          icon: <Gift className="h-4 w-4 text-primary" />,
          bg: "bg-primary/10",
        };
      case "EXPIRE":
        return {
          label: "Pontos expirados",
          icon: <Hourglass className="h-4 w-4 text-muted-foreground" />,
          bg: "bg-muted",
        };
      case "BONUS":
        return {
          label: "Bônus recebido",
          icon: <PartyPopper className="h-4 w-4 text-emerald-600" />,
          bg: "bg-emerald-500/10",
        };
      case "ADJUSTMENT":
        return {
          label: isPos ? "Estorno" : "Ajuste",
          icon: <Undo2 className="h-4 w-4 text-sky-600" />,
          bg: "bg-sky-500/10",
        };
      default:
        return {
          label: isPos ? "Créditos" : "Movimentação",
          icon: <Coins className="h-4 w-4 text-muted-foreground" />,
          bg: "bg-muted",
        };
    }
  })();

  const date = new Date(tx.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const extra = friendlyDescription(tx);

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${meta.bg}`}>
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{meta.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {extra ? `${extra} · ${date}` : date}
        </p>
      </div>
      <div className="text-right">
        <p
          className={`text-sm font-semibold tabular-nums ${
            isPos ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {isPos ? "+" : ""}
          {tx.points} pts
        </p>
        {tx.balance_after !== null && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            saldo {tx.balance_after}
          </p>
        )}
      </div>
    </div>
  );
}

// -------- Final CTA --------
function FinalCta({ slug }: { slug: string }) {
  return (
    <Card className="animate-fade-in overflow-hidden border-primary/30">
      <div className="flex items-center gap-4 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/15 text-3xl">
          🍔
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Gostou dos seus benefícios?</p>
          <p className="text-xs text-muted-foreground">
            Faça um novo pedido e acumule ainda mais pontos.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/$slug" params={{ slug }}>
            <Utensils className="mr-1.5 h-4 w-4" />
            Pedir agora
          </Link>
        </Button>
      </div>
    </Card>
  );
}
