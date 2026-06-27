import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, LogIn, ShoppingBag, Trash2, AlertTriangle, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BottomNavSpacer } from "@/components/BottomNav";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { listMyFavoritesEnriched, toggleFavorite, type EnrichedFavorite } from "@/lib/favorites";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/favoritos")({
  head: () => ({ meta: [{ title: "Favoritos — Localix" }] }),
  component: FavoritosPage,
});

function FavoritosPage() {
  const { loading, isAuthenticated } = useCustomerAuth();

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto max-w-2xl px-4 py-6">
        {loading ? <LoadingState /> : isAuthenticated ? <AuthedFavorites /> : <LoginPrompt />}
      </main>
      <BottomNavSpacer />
    </div>
  );
}

function getLastSlug(): string | null {
  try {
    return sessionStorage.getItem("localix:last-restaurant-slug");
  } catch {
    return null;
  }
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

function AuthedFavorites() {
  const [favorites, setFavorites] = useState<EnrichedFavorite[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setFavorites(await listMyFavoritesEnriched());
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível carregar seus favoritos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function removeFav(fav: EnrichedFavorite) {
    try {
      await toggleFavorite({ restaurantId: fav.restaurantId, kind: fav.kind, itemId: fav.itemId });
      setFavorites((prev) => prev?.filter((f) => f.id !== fav.id) ?? null);
      toast.success("Removido dos favoritos");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao remover");
    }
  }

  if (loading) return <LoadingState />;
  if (!favorites || favorites.length === 0) return <EmptyState />;

  // group by restaurant
  const groups = new Map<string, { name: string; slug: string; logo: string | null; items: EnrichedFavorite[] }>();
  for (const f of favorites) {
    const g = groups.get(f.restaurantId) ?? { name: f.restaurantName, slug: f.restaurantSlug, logo: f.restaurantLogo, items: [] };
    g.items.push(f);
    groups.set(f.restaurantId, g);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            <Sparkles className="mr-1 inline h-3 w-3 text-primary" /> Seus favoritos
          </p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Pratos favoritos</h1>
        </div>
        <span className="text-sm text-muted-foreground">{favorites.length} {favorites.length === 1 ? "item" : "itens"}</span>
      </header>

      {[...groups.values()].map((g) => (
        <section key={g.slug} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {g.logo ? (
                <img src={g.logo} alt="" className="h-9 w-9 rounded-xl object-cover ring-1 ring-border" />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-warm text-sm font-extrabold text-primary-foreground">
                  {g.name[0]}
                </div>
              )}
              <h2 className="truncate font-display text-base font-extrabold">{g.name}</h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link to="/$slug" params={{ slug: g.slug }}>
                Ver cardápio <ChevronRight className="ml-0.5 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-3">
            {g.items.map((f) => (
              <FavoriteCard key={f.id} fav={f} onRemove={() => removeFav(f)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FavoriteCard({ fav, onRemove }: { fav: EnrichedFavorite; onRemove: () => void }) {
  const navigate = useNavigate();

  function reorder() {
    if (!fav.available) return;
    if (fav.kind === "builder") {
      navigate({ to: "/$slug/montar", params: { slug: fav.restaurantSlug }, search: { builder: fav.itemId } as any });
    } else {
      navigate({ to: "/$slug", params: { slug: fav.restaurantSlug }, search: { add: fav.itemId } as any });
    }
  }

  const price = fav.promoPrice ?? fav.price;

  return (
    <Card className="overflow-hidden rounded-2xl">
      <div className="flex gap-3 p-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28">
          {fav.imageUrl ? (
            <img src={fav.imageUrl} alt={fav.name ?? ""} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center text-2xl">{fav.kind === "builder" ? "✨" : "🍽️"}</div>
          )}
          {!fav.available && (
            <div className="absolute inset-0 grid place-items-center bg-background/85 text-center">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-destructive">
                Indisponível
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-1 font-bold leading-snug">{fav.name ?? "Produto removido"}</h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {fav.categoryName && <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">{fav.categoryName}</Badge>}
                <span className="line-clamp-1">{fav.restaurantName}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remover dos favoritos"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            {fav.available ? (
              <div className="flex items-baseline gap-2">
                {fav.promoPrice != null && fav.price != null ? (
                  <>
                    <span className="font-display text-base font-extrabold text-primary">{brl(fav.promoPrice)}</span>
                    <span className="text-xs text-muted-foreground line-through">{brl(fav.price)}</span>
                  </>
                ) : price != null ? (
                  <span className="font-display text-base font-extrabold text-primary">{brl(price)}</span>
                ) : null}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Produto indisponível
              </span>
            )}
            <Button size="sm" className="rounded-full" disabled={!fav.available} onClick={reorder}>
              <ShoppingBag className="mr-1.5 h-4 w-4" />
              {fav.kind === "builder" ? "Montar" : "Pedir novamente"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  const lastSlug = getLastSlug();
  const [slugInput, setSlugInput] = useState("");
  const navigate = useNavigate();

  function explore() {
    const target = (slugInput.trim() || lastSlug || "").replace(/^\/+/, "").split("/")[0];
    if (!target) {
      toast.info("Informe o link do restaurante para começar.");
      return;
    }
    navigate({ to: "/$slug", params: { slug: target } });
  }

  return (
    <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="relative mx-auto mb-7 grid h-24 w-24 place-items-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-rose-500/10 blur-2xl" />
        <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-transparent ring-1 ring-rose-500/20">
          <Heart className="h-10 w-10 text-rose-500" strokeWidth={1.8} />
        </div>
      </div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Seus pratos favoritos aparecerão aqui</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
        Favoritando pizzas, hambúrgueres, combos e outros produtos, você poderá encontrá-los rapidamente e pedir novamente com apenas um toque.
      </p>

      {lastSlug ? (
        <Button asChild size="lg" className="mt-6 rounded-full">
          <Link to="/$slug" params={{ slug: lastSlug }}>Explorar cardápio</Link>
        </Button>
      ) : (
        <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2">
          <p className="text-xs text-muted-foreground">Informe o link do restaurante para começar:</p>
          <div className="flex gap-2">
            <Input
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              placeholder="ex.: pizzaria-sanliver"
              className="rounded-full"
            />
            <Button onClick={explore} className="rounded-full">Abrir</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginPrompt() {
  return (
    <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative mx-auto mb-7 grid h-24 w-24 place-items-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-rose-500/10 blur-2xl" />
        <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-transparent ring-1 ring-rose-500/20">
          <Heart className="h-10 w-10 text-rose-500" strokeWidth={1.8} />
        </div>
      </div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Seus favoritos</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Entre na sua conta para salvar e gerenciar seus pratos favoritos.
      </p>
      <div className="mt-7 flex flex-col gap-2">
        <Button asChild size="lg" className="rounded-full">
          <Link to="/cliente">
            <LogIn className="mr-2 h-4 w-4" /> Entrar na minha conta
          </Link>
        </Button>
      </div>
    </div>
  );
}
