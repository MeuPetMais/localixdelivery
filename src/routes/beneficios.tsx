import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Gift,
  Ticket,
  Star,
  Percent,
  LogIn,
  Trophy,
  ArrowRight,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNavSpacer } from "@/components/BottomNav";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { getMyBenefits, type BenefitsPayload } from "@/lib/benefits.functions";
import { brl } from "@/lib/format";
import { useCustomerNavigation } from "@/contexts/CustomerNavigationContext";

export const Route = createFileRoute("/beneficios")({
  head: () => ({ meta: [{ title: "Meus Benefícios — Localix" }] }),
  component: BeneficiosPage,
});

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return null;
  }
}

// ---- Generic Benefit Card (white-label renderer) ----
type RestaurantRef = { name: string; slug: string; logo_url: string | null };

type BenefitCardProps = {
  restaurant: RestaurantRef;
  icon?: React.ReactNode;
  image?: string | null;
  title: string;
  description?: string | null;
  meta?: string | null;
  badge?: string | null;
  ctaLabel: string;
  onCta: () => void;
};

function BenefitCard({ restaurant, icon, image, title, description, meta, badge, ctaLabel, onCta }: BenefitCardProps) {
  return (
    <Card className="overflow-hidden transition hover:shadow-md">
      {image && (
        <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
          <img src={image} alt={title} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2">
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="h-6 w-6 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {restaurant.name.charAt(0)}
            </div>
          )}
          <span className="text-xs font-medium text-muted-foreground truncate">{restaurant.name}</span>
          {badge && <Badge variant="secondary" className="ml-auto text-[10px]">{badge}</Badge>}
        </div>
        <div className="mt-2 flex items-start gap-2">
          {icon && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div>}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            {description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{description}</p>}
            {meta && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3" /> {meta}
              </p>
            )}
          </div>
        </div>
        <Button onClick={onCta} size="sm" className="mt-3 w-full rounded-full">
          {ctaLabel} <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function BeneficiosPage() {
  const { loading: authLoading, isAuthenticated } = useCustomerAuth();
  const navigate = useNavigate();
  const { lastRestaurantSlug, currentRestaurantSlug, prepareLoginRedirect } = useCustomerNavigation();
  const lastSlug = currentRestaurantSlug ?? lastRestaurantSlug;

  const fetchBenefits = useServerFn(getMyBenefits);
  const { data, isLoading } = useQuery<BenefitsPayload>({
    queryKey: ["my-benefits"],
    queryFn: () => fetchBenefits(),
    enabled: isAuthenticated,
  });

  const goToRestaurant = (slug: string, params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    navigate({ to: "/$slug", params: { slug }, search: qs ? Object.fromEntries(new URLSearchParams(qs)) as any : undefined });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto max-w-2xl px-5 py-8">
        <header className="mb-6 text-center animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent ring-1 ring-primary/20">
            <Gift className="h-7 w-7 text-primary" strokeWidth={1.8} />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">🎁 Meus Benefícios</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Todos os seus benefícios, cupons, campanhas e recompensas em um único lugar.
          </p>
        </header>

        {/* Not authenticated */}
        {!authLoading && !isAuthenticated && (
          <Card className="border-primary/30 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <LogIn className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Entre para ver seus benefícios</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Acesse sua conta para visualizar cupons, promoções, fidelidade e recompensas dos estabelecimentos parceiros.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" className="rounded-full">
                    <Link to="/entrar" search={{ redirect: prepareLoginRedirect(lastSlug) }}>Entrar</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="rounded-full">
                    <Link to="/entrar" search={{ redirect: prepareLoginRedirect(lastSlug) }}>Criar conta</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Loading */}
        {isAuthenticated && isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        )}

        {/* Data */}
        {isAuthenticated && !isLoading && data && (
          <BenefitsContent data={data} lastSlug={lastSlug} onGoTo={goToRestaurant} />
        )}
      </main>
      <BottomNavSpacer />
    </div>
  );
}

function BenefitsContent({
  data,
  lastSlug,
  onGoTo,
}: {
  data: BenefitsPayload;
  lastSlug: string | null;
  onGoTo: (slug: string, params?: Record<string, string>) => void;
}) {
  const hasAnything =
    data.coupons.length > 0 ||
    data.promotions.length > 0 ||
    data.loyalty.length > 0 ||
    data.points.total > 0;

  if (!hasAnything) {
    return <EmptyState lastSlug={lastSlug} />;
  }

  return (
    <div className="space-y-8">
      {/* Points summary */}
      {data.points.total > 0 && (
        <Card className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pontos acumulados</p>
              <p className="mt-1 font-display text-3xl font-extrabold">{data.points.total}</p>
              <p className="mt-1 text-xs text-muted-foreground">Use seus pontos em estabelecimentos participantes</p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Trophy className="h-7 w-7" />
            </div>
          </div>
        </Card>
      )}

      {/* Coupons */}
      {data.coupons.length > 0 && (
        <section>
          <SectionTitle icon={Ticket} title="Cupons disponíveis" subtitle="Use no próximo pedido" />
          <div className="grid gap-3 sm:grid-cols-2">
            {data.coupons.map((c) => (
              <BenefitCard
                key={c.id}
                restaurant={c.restaurant}
                icon={<Ticket className="h-4 w-4" />}
                title={c.code}
                description={`${c.discountPercent}% de desconto no seu próximo pedido`}
                meta={c.validUntil ? `Válido até ${formatDate(c.validUntil)}` : "Sem validade"}
                badge={`-${c.discountPercent}%`}
                ctaLabel="Usar agora"
                onCta={() => onGoTo(c.restaurant.slug, { coupon: c.code })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Promotions */}
      {data.promotions.length > 0 && (
        <section>
          <SectionTitle icon={Percent} title="Promoções ativas" subtitle="Aproveite enquanto durar" />
          <div className="grid gap-3 sm:grid-cols-2">
            {data.promotions.slice(0, 8).map((p) => {
              const discount = Math.round((1 - p.promoPrice / p.price) * 100);
              return (
                <BenefitCard
                  key={p.id}
                  restaurant={p.restaurant}
                  image={p.imageUrl}
                  icon={<Sparkles className="h-4 w-4" />}
                  title={p.name}
                  description={`De ${brl(p.price)} por ${brl(p.promoPrice)}`}
                  meta={p.promoEndsAt ? `Termina em ${formatDate(p.promoEndsAt)}` : null}
                  badge={`-${discount}%`}
                  ctaLabel="Ver oferta"
                  onCta={() => onGoTo(p.restaurant.slug, { add: p.id })}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Loyalty */}
      {data.loyalty.length > 0 && (
        <section>
          <SectionTitle icon={Star} title="Programa fidelidade" subtitle="Seu progresso por estabelecimento" />
          <div className="space-y-3">
            {data.loyalty.map((l) => {
              const pct = Math.min(100, Math.round((l.ordersCount / l.goal) * 100));
              return (
                <Card key={l.restaurant.id} className="p-4">
                  <div className="flex items-center gap-3">
                    {l.restaurant.logo_url ? (
                      <img src={l.restaurant.logo_url} alt={l.restaurant.name} className="h-10 w-10 rounded-xl object-cover ring-1 ring-border" />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 font-bold text-primary">
                        {l.restaurant.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{l.restaurant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.ordersCount} de {l.goal} pedidos
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => onGoTo(l.restaurant.slug)}>
                      Ver
                    </Button>
                  </div>
                  <Progress value={pct} className="mt-3 h-2" />
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState({ lastSlug }: { lastSlug: string | null }) {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
        <Gift className="h-10 w-10" strokeWidth={1.5} />
      </div>
      <h2 className="font-display text-lg font-bold">Você ainda não possui benefícios disponíveis.</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Assim que realizar pedidos ou participar das campanhas dos estabelecimentos parceiros, seus benefícios aparecerão aqui automaticamente.
      </p>
      <div className="mt-5">
        {lastSlug ? (
          <Button asChild className="rounded-full">
            <Link to="/$slug" params={{ slug: lastSlug }}>Explorar cardápio</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Acesse um cardápio pelo link compartilhado do estabelecimento para começar.
          </p>
        )}
      </div>
    </Card>
  );
}
