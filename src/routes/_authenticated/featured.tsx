import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Star, Loader2, Search, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getFeaturedSections, type FeaturedDiagnostic } from "@/lib/featured-sections.functions";

export const Route = createFileRoute("/_authenticated/featured")({
  head: () => ({ meta: [{ title: "Categorias em Destaque — Localix" }] }),
  component: FeaturedPage,
});

type Config = {
  restaurant_id: string;
  promotions_enabled: boolean;
  weekly_favorites_enabled: boolean;
  top_rated_enabled: boolean;
  new_items_enabled: boolean;
  customer_favorites_enabled: boolean;
  half_half_pizza_enabled: boolean;
};

const DEFAULTS: Omit<Config, "restaurant_id"> = {
  promotions_enabled: true,
  weekly_favorites_enabled: true,
  top_rated_enabled: true,
  new_items_enabled: true,
  customer_favorites_enabled: true,
  half_half_pizza_enabled: false,
};

const TOGGLES: Array<{
  key: keyof Omit<Config, "restaurant_id">;
  diagKey: FeaturedDiagnostic["key"];
  label: string;
  emoji: string;
  desc: string;
}> = [
  {
    key: "promotions_enabled",
    diagKey: "promotions",
    label: "Promoções",
    emoji: "⭐",
    desc: "Apenas mostra ou oculta a seção na página pública. Crie e gerencie promoções no módulo Promoções.",
  },
  { key: "weekly_favorites_enabled", diagKey: "weekly_favorites", label: "Queridinhos da Semana", emoji: "🔥", desc: "Marcados manualmente na lista abaixo." },
  { key: "top_rated_enabled", diagKey: "top_rated", label: "Mais Bem Avaliados", emoji: "🏆", desc: "Produtos com pelo menos 5 avaliações." },
  { key: "new_items_enabled", diagKey: "new_items", label: "Novidades", emoji: "🆕", desc: "Produtos cadastrados nos últimos 30 dias." },
  { key: "customer_favorites_enabled", diagKey: "customer_favorites", label: "Favoritos dos Clientes", emoji: "❤️", desc: "Os produtos mais salvos pelos clientes." },
  { key: "half_half_pizza_enabled", diagKey: "half_half_pizza", label: "Pizza Meio a Meio", emoji: "🍕", desc: "Requer um Builder de montagem cadastrado." },
];

function FeaturedPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("restaurants")
      .select("id, slug")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRestaurantId(data?.id ?? null);
        setRestaurantSlug(data?.slug ?? null);
      });
  }, [user]);

  const { data: config, isLoading } = useQuery({
    queryKey: ["featured-config", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("featured_sections" as any)
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .maybeSingle();
      return (data as Config | null) ?? { restaurant_id: restaurantId!, ...DEFAULTS };
    },
  });

  const fetchFeatured = useServerFn(getFeaturedSections);
  const { data: diag, isFetching: diagLoading } = useQuery({
    queryKey: ["featured-diagnostics", restaurantSlug, config],
    enabled: !!restaurantSlug,
    queryFn: () => fetchFeatured({ data: { slug: restaurantSlug! } }),
    staleTime: 30_000,
  });
  const diagnostics = diag?.diagnostics ?? [];
  const diagByKey = new Map(diagnostics.map((d) => [d.key, d]));

  const saveConfig = useMutation({
    mutationFn: async (patch: Partial<Config>) => {
      if (!restaurantId) return;
      const merged = { ...(config ?? { restaurant_id: restaurantId, ...DEFAULTS }), ...patch, restaurant_id: restaurantId };
      const { error } = await supabase
        .from("featured_sections" as any)
        .upsert(merged, { onConflict: "restaurant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["featured-config", restaurantId] });
      qc.invalidateQueries({ queryKey: ["featured-diagnostics", restaurantSlug] });
      qc.invalidateQueries({ queryKey: ["featured-sections", restaurantSlug] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["featured-items", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, is_weekly_favorite, image_url, price")
        .eq("restaurant_id", restaurantId!)
        .eq("is_active", true)
        .order("position")
        .limit(200);
      return (data ?? []) as any[];
    },
  });

  const toggleWeekly = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("menu_items").update({ is_weekly_favorite: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["featured-items", restaurantId] });
      qc.invalidateQueries({ queryKey: ["featured-diagnostics", restaurantSlug] });
      qc.invalidateQueries({ queryKey: ["featured-sections", restaurantSlug] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const weeklyCount = items.filter((i) => i.is_weekly_favorite).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Categorias em Destaque</h1>
          <p className="text-sm text-muted-foreground">
            Ative coleções que organizam o cardápio automaticamente na página pública. Categorias vazias ficam ocultas.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0">
              <Search className="mr-1.5 h-4 w-4" /> Diagnóstico
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🔍 Diagnóstico das Categorias</DialogTitle>
            </DialogHeader>
            {diagLoading && diagnostics.length === 0 ? (
              <div className="space-y-2">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <ul className="divide-y">
                {diagnostics.map((d) => (
                  <li key={d.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold">{d.emoji} {d.label}</p>
                      <p className="text-xs text-muted-foreground">{d.note}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={d.enabled ? "default" : "secondary"} className="gap-1">
                        {d.enabled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {d.enabled ? "habilitada" : "desativada"}
                      </Badge>
                      <Badge variant={d.rendered ? "default" : "outline"} className="gap-1">
                        {d.rendered ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {d.count} {d.count === 1 ? "item" : "itens"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      </header>

      <Card className="border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-semibold">Sobre Promoções</p>
        <p className="text-muted-foreground">
          O único lugar para criar, editar, pausar ou encerrar promoções é o módulo{" "}
          <Link to="/promotions" className="font-semibold text-primary underline">Promoções</Link>.
          Aqui você só decide se a seção aparece na página pública.
        </p>
      </Card>

      <Card className="divide-y p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : (
          TOGGLES.map((t) => {
            const d = diagByKey.get(t.diagKey);
            const enabled = !!config?.[t.key];
            return (
              <div key={t.key} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Label htmlFor={t.key} className="flex items-center gap-2 text-base font-semibold">
                    <span>{t.emoji}</span> {t.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant={enabled ? "default" : "secondary"} className="gap-1 text-[10px]">
                      {enabled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {enabled ? "Ativa" : "Desativada"}
                    </Badge>
                    {d && (
                      <Badge variant={d.rendered ? "default" : "outline"} className="text-[10px]">
                        {t.diagKey === "half_half_pizza"
                          ? (d.count > 0 ? "Builder encontrado" : "Builder inexistente")
                          : `${d.count} ${d.count === 1 ? "produto encontrado" : "produtos encontrados"}`}
                      </Badge>
                    )}
                    {enabled && d && !d.rendered && (
                      <span className="text-[10px] text-amber-600">Oculta: {d.note}</span>
                    )}
                  </div>
                </div>
                <Switch
                  id={t.key}
                  disabled={saveConfig.isPending}
                  checked={enabled}
                  onCheckedChange={(v) => saveConfig.mutate({ [t.key]: v } as any)}
                />
              </div>
            );
          })
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
              <Star className="h-4 w-4 text-primary" /> Queridinhos da Semana
            </h2>
            <p className="text-xs text-muted-foreground">
              Marque até 10 produtos. Atualmente: <strong>{weeklyCount}/10</strong>
            </p>
          </div>
          {restaurantSlug && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/$slug" params={{ slug: restaurantSlug }}>
                Ver na página pública <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
        {loadingItems ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <ul className="divide-y">
            {items.map((it) => {
              const marked = !!it.is_weekly_favorite;
              const disabled = !marked && weeklyCount >= 10;
              return (
                <li key={it.id} className="flex items-center gap-3 py-2">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    {it.image_url && <img src={it.image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{it.name}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={marked ? "default" : "outline"}
                    disabled={disabled || toggleWeekly.isPending}
                    onClick={() => toggleWeekly.mutate({ id: it.id, value: !marked })}
                  >
                    {toggleWeekly.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : marked ? "Marcado" : "Marcar"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
