import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, Store, Tag, Heart, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useState, useMemo } from "react";
import { getStoredRestaurantPath } from "@/contexts/CustomerNavigationContext";

export const Route = createFileRoute("/home")({
  beforeLoad: () => {
    const restaurantPath = getStoredRestaurantPath();
    if (restaurantPath) throw redirect({ href: restaurantPath, replace: true });
  },
  head: () => ({
    meta: [
      { title: "Localix — Peça do seu restaurante favorito" },
      { name: "description", content: "Descubra restaurantes, promoções e peça pelo WhatsApp." },
    ],
  }),
  component: CustomerHome,
});

type PublicRestaurant = {
  slug: string;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  category: string | null;
  is_open: boolean | null;
};

function CustomerHome() {
  const [q, setQ] = useState("");

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["customer-home", "restaurants"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("restaurants_public")
        .select("slug, name, logo_url, cover_url, category, is_open")
        .order("name", { ascending: true })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as PublicRestaurant[];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return restaurants;
    return restaurants.filter(
      (r) =>
        r.name?.toLowerCase().includes(term) ||
        (r.category ?? "").toLowerCase().includes(term),
    );
  }, [restaurants, q]);

  const categories = useMemo(() => {
    const set = new Map<string, number>();
    for (const r of restaurants) {
      const c = (r.category ?? "").trim();
      if (!c) continue;
      set.set(c, (set.get(c) ?? 0) + 1);
    }
    return Array.from(set.entries()).slice(0, 8);
  }, [restaurants]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3">
          <h1 className="font-display text-xl font-extrabold">Boa fome? 🍔</h1>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar restaurantes ou cozinhas"
              className="pl-9"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-5">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Promoções</h2>
          </div>
          <Card className="overflow-hidden bg-gradient-warm p-5 text-primary-foreground">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Hoje</p>
            <p className="mt-1 text-lg font-extrabold">Cupons e ofertas dos restaurantes próximos</p>
            <Link to="/beneficios" className="mt-3 inline-flex rounded-full bg-background/20 px-3 py-1 text-xs font-semibold backdrop-blur">
              Ver benefícios →
            </Link>
          </Card>
        </section>

        {categories.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Categorias</h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(([c, n]) => (
                <button
                  key={c}
                  onClick={() => setQ(c)}
                  className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
                >
                  {c} <span className="text-muted-foreground">· {n}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Estabelecimentos</h2>
          </div>
          {isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhum restaurante encontrado.
            </Card>
          ) : (
            <ul className="grid gap-3">
              {filtered.map((r) => (
                <li key={r.slug}>
                  <Link
                    to="/$slug"
                    params={{ slug: r.slug }}

                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 transition hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {r.logo_url ? (
                        <img src={r.logo_url} alt={r.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-lg font-bold text-muted-foreground">
                          {r.name?.[0] ?? "?"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.name}</p>
                      {r.category && (
                        <p className="truncate text-xs text-muted-foreground">{r.category}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Link to="/favoritos" className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/40">
            <Heart className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Favoritos</span>
          </Link>
          <Link to="/meus-pedidos" className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/40">
            <Receipt className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Pedidos</span>
          </Link>
        </section>
      </main>
    </div>
  );
}
