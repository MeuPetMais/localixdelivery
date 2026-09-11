import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pizza } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BuilderCatalogFlavorControls,
  type BuilderCatalogFlavorOption,
} from "@/components/builders/BuilderCatalogFlavorControls";

export const Route = createFileRoute("/_authenticated/builders/catalog-flavors")({
  head: () => ({ meta: [{ title: "Sabores do cardápio — Localix" }] }),
  component: BuilderCatalogFlavorsPage,
});

type BuilderGroup = {
  id: string;
  builder_id: string;
  name: string;
  position: number;
  min_select: number;
  max_select: number;
  is_required: boolean;
  source_type?: string | null;
  price_strategy?: string | null;
  builder_options: BuilderCatalogFlavorOption[];
};

type BuilderRow = {
  id: string;
  name: string;
  emoji?: string | null;
  is_active?: boolean | null;
  builder_groups: BuilderGroup[];
};

function BuilderCatalogFlavorsPage() {
  const restaurant = useRestaurant();
  const [builderId, setBuilderId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  const {
    data: builders = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["builder-catalog-flavor-manager", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builders")
        .select("*, builder_groups(*, builder_options(*))")
        .eq("restaurant_id", restaurant!.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as BuilderRow[];
    },
  });

  const activeBuilder = useMemo(() => {
    if (!builders.length) return null;
    return builders.find((builder) => builder.id === builderId) ?? builders[0];
  }, [builders, builderId]);

  const groups = useMemo(
    () => (activeBuilder?.builder_groups ?? []).slice().sort((a, b) => a.position - b.position),
    [activeBuilder],
  );

  const flavorLikeGroup = useMemo(() => {
    if (!groups.length) return null;
    const selected = groups.find((group) => group.id === groupId);
    if (selected) return selected;
    return (
      groups.find((group) => /sabor|sabores|recheio/i.test(group.name)) ??
      groups.find((group) => group.source_type === "MENU_ITEMS") ??
      groups[0]
    );
  }, [groups, groupId]);

  if (!restaurant) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="rounded-full">
            <Link to="/builders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Monte do Seu Jeito</p>
            <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Pizza className="h-6 w-6 text-primary" /> Sabores do cardápio
            </h1>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-bold">Como funciona</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o configurador e a etapa de sabores. Depois marque as pizzas já cadastradas no
          cardápio e sincronize. O cliente passa a escolher os mesmos produtos e o preço da pizza
          usa o maior valor entre os sabores selecionados.
        </p>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando configuradores…
        </div>
      ) : builders.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Nenhum configurador encontrado. Crie primeiro o “Monte sua Pizza”.
        </Card>
      ) : (
        <>
          <Card className="rounded-2xl p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Configurador
                </p>
                <div className="flex flex-wrap gap-2">
                  {builders.map((builder) => (
                    <button
                      key={builder.id}
                      type="button"
                      onClick={() => {
                        setBuilderId(builder.id);
                        setGroupId(null);
                      }}
                      className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                        activeBuilder?.id === builder.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card hover:border-primary/40"
                      }`}
                    >
                      {builder.emoji ?? "🍕"} {builder.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Etapa que representa sabores
                </p>
                <div className="flex flex-wrap gap-2">
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setGroupId(group.id)}
                      className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                        flavorLikeGroup?.id === group.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card hover:border-primary/40"
                      }`}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {flavorLikeGroup ? (
            <BuilderCatalogFlavorControls
              restaurantId={restaurant.id}
              groupId={flavorLikeGroup.id}
              sourceType={flavorLikeGroup.source_type}
              options={flavorLikeGroup.builder_options ?? []}
              onSynced={() => refetch()}
            />
          ) : (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Este configurador ainda não possui etapas. Crie a etapa “Sabores” antes de
              sincronizar.
            </Card>
          )}
        </>
      )}
    </div>
  );
}
