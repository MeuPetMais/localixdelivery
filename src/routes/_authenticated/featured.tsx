import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

const TOGGLES: Array<{ key: keyof Omit<Config, "restaurant_id">; label: string; emoji: string; desc: string }> = [
  { key: "promotions_enabled", label: "Promoções", emoji: "⭐", desc: "Produtos com preço promocional ativo." },
  { key: "weekly_favorites_enabled", label: "Queridinhos da Semana", emoji: "🔥", desc: "Marcados manualmente na lista abaixo." },
  { key: "top_rated_enabled", label: "Mais Bem Avaliados", emoji: "🏆", desc: "Mínimo de 5 avaliações por produto." },
  { key: "new_items_enabled", label: "Novidades", emoji: "🆕", desc: "Produtos cadastrados nos últimos 30 dias." },
  { key: "customer_favorites_enabled", label: "Favoritos dos Clientes", emoji: "❤️", desc: "Os mais salvos como favorito." },
  { key: "half_half_pizza_enabled", label: "Pizza Meio a Meio", emoji: "🍕", desc: "Somente pizzarias com builder correspondente." },
];

function FeaturedPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [isPizzeria, setIsPizzeria] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("restaurants")
      .select("id, category")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRestaurantId(data?.id ?? null);
        setIsPizzeria(/pizz/i.test(String(data?.category ?? "")));
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

  const saveConfig = useMutation({
    mutationFn: async (patch: Partial<Config>) => {
      if (!restaurantId) return;
      const merged = { ...(config ?? { restaurant_id: restaurantId, ...DEFAULTS }), ...patch, restaurant_id: restaurantId };
      const { error } = await supabase
        .from("featured_sections" as any)
        .upsert(merged, { onConflict: "restaurant_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["featured-config", restaurantId] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["featured-items", restaurantId] }),
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const weeklyCount = items.filter((i) => i.is_weekly_favorite).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Categorias em Destaque</h1>
        <p className="text-sm text-muted-foreground">
          Ative coleções inteligentes que organizam o cardápio automaticamente na página pública.
        </p>
      </header>

      <Card className="divide-y p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : (
          TOGGLES.map((t) => {
            const disabled = t.key === "half_half_pizza_enabled" && !isPizzeria;
            return (
              <div key={t.key} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Label htmlFor={t.key} className="flex items-center gap-2 text-base font-semibold">
                    <span>{t.emoji}</span> {t.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t.desc}{disabled ? " Disponível apenas para pizzarias." : ""}
                  </p>
                </div>
                <Switch
                  id={t.key}
                  disabled={disabled || saveConfig.isPending}
                  checked={!!config?.[t.key]}
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
