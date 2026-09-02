import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Ingredient = { id: string; name: string; unit: string; stock: number };
type Mapping = { id: string; builder_option_id: string; ingredient_id: string; quantity: number };
type BuilderOption = { id: string; name: string; position: number };
type BuilderGroup = { id: string; name: string; position: number; builder_options: BuilderOption[] };
type Builder = { id: string; name: string; emoji: string | null; builder_groups: BuilderGroup[] };

export function BuilderStockPanel({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { ingredientId: string; quantity: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["builder-stock-mapping", restaurantId],
    queryFn: async () => {
      const [{ data: builders, error: buildersError }, { data: ingredients, error: ingredientsError }] = await Promise.all([
        supabase
          .from("builders")
          .select("id,name,emoji,builder_groups(id,name,position,builder_options(id,name,position))")
          .eq("restaurant_id", restaurantId)
          .order("position"),
        supabase
          .from("ingredients")
          .select("id,name,unit,stock")
          .eq("restaurant_id", restaurantId)
          .eq("active", true)
          .order("name"),
      ]);
      if (buildersError) throw buildersError;
      if (ingredientsError) throw ingredientsError;

      const optionIds = ((builders ?? []) as Builder[])
        .flatMap((b) => b.builder_groups ?? [])
        .flatMap((g) => g.builder_options ?? [])
        .map((o) => o.id);

      let mappings: Mapping[] = [];
      if (optionIds.length) {
        const { data: mappingRows, error: mappingError } = await supabase
          .from("builder_option_ingredients")
          .select("id,builder_option_id,ingredient_id,quantity")
          .in("builder_option_id", optionIds);
        if (mappingError) throw mappingError;
        mappings = (mappingRows ?? []) as Mapping[];
      }

      return { builders: (builders ?? []) as Builder[], ingredients: (ingredients ?? []) as Ingredient[], mappings };
    },
  });

  const mappingsByOption = useMemo(() => {
    const map = new Map<string, Mapping[]>();
    for (const mapping of data?.mappings ?? []) {
      const list = map.get(mapping.builder_option_id) ?? [];
      list.push(mapping);
      map.set(mapping.builder_option_id, list);
    }
    return map;
  }, [data?.mappings]);

  if (isLoading) {
    return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const ingredients = data?.ingredients ?? [];
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  async function addMapping(optionId: string) {
    const draft = drafts[optionId];
    const ingredient = ingredientById.get(draft?.ingredientId ?? "");
    const quantity = Number(String(draft?.quantity ?? "").replace(",", "."));
    if (!ingredient) return toast.error("Selecione um ingrediente.");
    if (!Number.isFinite(quantity) || quantity <= 0) return toast.error("Informe uma quantidade válida.");

    const { error } = await supabase.from("builder_option_ingredients").insert({
      builder_option_id: optionId,
      ingredient_id: ingredient.id,
      quantity,
    });
    if (error) {
      if (error.code === "23505") return toast.error("Este ingrediente já está vinculado a esta opção.");
      return toast.error(error.message);
    }
    setDrafts((current) => ({ ...current, [optionId]: { ingredientId: "", quantity: "" } }));
    await qc.invalidateQueries({ queryKey: ["builder-stock-mapping", restaurantId] });
    toast.success("Ingrediente vinculado");
  }

  async function removeMapping(id: string) {
    const { error } = await supabase.from("builder_option_ingredients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["builder-stock-mapping", restaurantId] });
    toast.success("Vínculo removido");
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border bg-amber-500/5 p-4 text-sm">
        <strong>Estoque do Monte do Seu Jeito:</strong> vincule cada opção consumível a um ingrediente físico e à quantidade usada. Opções sem consumo, como ponto da carne, podem ficar sem vínculo.
      </Card>

      {(data?.builders ?? []).map((builder) => (
        <Card key={builder.id} className="rounded-2xl p-5">
          <h2 className="mb-4 font-display text-xl font-bold">{builder.emoji ?? "✨"} {builder.name}</h2>
          <div className="space-y-5">
            {(builder.builder_groups ?? []).sort((a, b) => a.position - b.position).map((group) => (
              <div key={group.id} className="space-y-2">
                <h3 className="text-sm font-bold text-muted-foreground">{group.name}</h3>
                {(group.builder_options ?? []).sort((a, b) => a.position - b.position).map((option) => {
                  const mappings = mappingsByOption.get(option.id) ?? [];
                  const draft = drafts[option.id] ?? { ingredientId: "", quantity: "" };
                  return (
                    <Card key={option.id} className="rounded-xl p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold">{option.name}</p>
                        <span className="text-xs text-muted-foreground">{mappings.length ? `${mappings.length} vínculo(s)` : "Sem consumo configurado"}</span>
                      </div>

                      {mappings.length > 0 && (
                        <div className="mb-3 space-y-2">
                          {mappings.map((mapping) => {
                            const ingredient = ingredientById.get(mapping.ingredient_id);
                            return (
                              <div key={mapping.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                                <span>{ingredient?.name ?? "Ingrediente"} — <strong>{Number(mapping.quantity)} {ingredient?.unit ?? ""}</strong></span>
                                <Button size="sm" variant="ghost" onClick={() => removeMapping(mapping.id)} aria-label="Remover vínculo">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto] sm:items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Ingrediente</Label>
                          <select
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={draft.ingredientId}
                            onChange={(e) => setDrafts((current) => ({ ...current, [option.id]: { ...draft, ingredientId: e.target.value } }))}
                          >
                            <option value="">Selecione</option>
                            {ingredients.map((ingredient) => (
                              <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Quantidade consumida</Label>
                          <Input
                            inputMode="decimal"
                            value={draft.quantity}
                            onChange={(e) => setDrafts((current) => ({ ...current, [option.id]: { ...draft, quantity: e.target.value } }))}
                            placeholder="Ex: 30"
                          />
                        </div>
                        <Button onClick={() => addMapping(option.id)}><Plus className="mr-1 h-4 w-4" />Vincular</Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      ))}

      {(data?.builders ?? []).length === 0 && (
        <Card className="rounded-2xl p-8 text-center text-muted-foreground">Nenhum Builder cadastrado.</Card>
      )}
    </div>
  );
}
