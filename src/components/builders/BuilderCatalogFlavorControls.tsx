import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { isPromoActiveNow } from "@/lib/promotions";

export type BuilderCatalogFlavorOption = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  max_qty: number;
  position: number;
  menu_item_id?: string | null;
  menu_item?: {
    id: string;
    restaurant_id: string;
    name: string;
    price: number;
    promo_price?: number | null;
    promo_starts_at?: string | null;
    promo_ends_at?: string | null;
    recurrence_days?: number[] | null;
    recurrence_start_time?: string | null;
    recurrence_end_time?: string | null;
    is_active?: boolean | null;
    is_available?: boolean | null;
    is_paused?: boolean | null;
  } | null;
};

type MenuCategory = { id: string; name: string };
type MenuItem = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  price: number;
  promo_price?: number | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  recurrence_days?: number[] | null;
  recurrence_start_time?: string | null;
  recurrence_end_time?: string | null;
  is_active?: boolean | null;
  is_available?: boolean | null;
  is_paused?: boolean | null;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isCatalogAvailable(item: MenuItem) {
  return item.is_active !== false && item.is_available !== false && item.is_paused !== true;
}

function currentPrice(item: MenuItem) {
  return isPromoActiveNow(item) ? Number(item.promo_price) : Number(item.price);
}

export function BuilderCatalogFlavorControls({
  restaurantId,
  groupId,
  sourceType,
  options,
  onSynced,
}: {
  restaurantId: string;
  groupId: string;
  sourceType?: string | null;
  options: BuilderCatalogFlavorOption[];
  onSynced: (payload: {
    source_type: "MENU_ITEMS";
    price_strategy: "MAX_MENU_ITEM";
    builder_options: BuilderCatalogFlavorOption[];
  }) => void;
}) {
  const linkedIds = useMemo(
    () => options.map((option) => option.menu_item_id).filter((id): id is string => !!id),
    [options],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(linkedIds));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(new Set(linkedIds));
  }, [groupId, linkedIds.join("|")]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["builder-catalog-flavors", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const [categoriesResult, itemsResult] = await Promise.all([
        supabase
          .from("menu_categories")
          .select("id, name")
          .eq("restaurant_id", restaurantId)
          .order("position"),
        supabase
          .from("menu_items")
          .select(
            "id, restaurant_id, category_id, name, price, promo_price, promo_starts_at, promo_ends_at, recurrence_days, recurrence_start_time, recurrence_end_time, is_active, is_available, is_paused",
          )
          .eq("restaurant_id", restaurantId)
          .order("position"),
      ]);
      if (categoriesResult.error) throw categoriesResult.error;
      if (itemsResult.error) throw itemsResult.error;
      return {
        categories: (categoriesResult.data ?? []) as MenuCategory[],
        items: (itemsResult.data ?? []) as MenuItem[],
      };
    },
  });

  const candidates = useMemo(() => {
    const categories = data?.categories ?? [];
    const items = (data?.items ?? []).filter(isCatalogAvailable);
    const pizzaCategoryIds = new Set(
      categories
        .filter((category) => /pizza|pizzas|pizzaria/.test(normalize(category.name)))
        .map((category) => category.id),
    );
    const filtered = pizzaCategoryIds.size
      ? items.filter((item) => !!item.category_id && pizzaCategoryIds.has(item.category_id))
      : items;
    return filtered.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [data]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function sync() {
    if (selected.size === 0) {
      toast.error("Selecione ao menos uma pizza do cardápio.");
      return;
    }

    const selectedItems = candidates.filter((item) => selected.has(item.id));
    if (selectedItems.length !== selected.size) {
      toast.error("Uma das pizzas selecionadas não está mais disponível no cardápio.");
      return;
    }

    const hasManualOptions = options.some((option) => !option.menu_item_id);
    if (sourceType !== "MENU_ITEMS" && hasManualOptions) {
      const confirmed = window.confirm(
        "Ao vincular esta etapa ao cardápio, as opções manuais atuais serão substituídas pelas pizzas selecionadas. Deseja continuar?",
      );
      if (!confirmed) return;
    }

    setSaving(true);
    const previousWasCatalog = sourceType === "MENU_ITEMS";
    try {
      const { error: groupError } = await supabase
        .from("builder_groups")
        .update({ source_type: "MENU_ITEMS", price_strategy: "MAX_MENU_ITEM" })
        .eq("id", groupId);
      if (groupError) throw groupError;

      const existingByMenuItem = new Map(
        options.filter((option) => option.menu_item_id).map((option) => [option.menu_item_id!, option]),
      );
      const missing = selectedItems.filter((item) => !existingByMenuItem.has(item.id));

      if (missing.length) {
        const rows = missing.map((item, index) => ({
          group_id: groupId,
          name: item.name,
          price_delta: 0,
          max_qty: 1,
          position: options.length + index,
          menu_item_id: item.id,
        }));
        const { error: insertError } = await supabase.from("builder_options").insert(rows);
        if (insertError) throw insertError;
      }

      const { data: refreshed, error: refreshError } = await supabase
        .from("builder_options")
        .select("id, group_id, name, price_delta, max_qty, position, menu_item_id")
        .eq("group_id", groupId)
        .order("position");
      if (refreshError) throw refreshError;

      const rows = (refreshed ?? []) as BuilderCatalogFlavorOption[];
      const removeIds = rows
        .filter((option) => !option.menu_item_id || !selected.has(option.menu_item_id))
        .map((option) => option.id);
      if (removeIds.length) {
        const { error: deleteError } = await supabase
          .from("builder_options")
          .delete()
          .in("id", removeIds);
        if (deleteError) throw deleteError;
      }

      const finalOptions: BuilderCatalogFlavorOption[] = selectedItems.map((item, index) => {
        const existing = rows.find((option) => option.menu_item_id === item.id);
        return {
          id: existing?.id ?? `catalog:${item.id}`,
          group_id: groupId,
          name: item.name,
          price_delta: 0,
          max_qty: 1,
          position: existing?.position ?? index,
          menu_item_id: item.id,
          menu_item: item,
        };
      });

      onSynced({
        source_type: "MENU_ITEMS",
        price_strategy: "MAX_MENU_ITEM",
        builder_options: finalOptions,
      });
      toast.success(`${finalOptions.length} sabores sincronizados com o cardápio.`);
    } catch (error: any) {
      if (!previousWasCatalog) {
        await supabase
          .from("builder_groups")
          .update({ source_type: "MANUAL", price_strategy: "SUM" })
          .eq("id", groupId);
      }
      toast.error(error?.message ?? "Não foi possível sincronizar os sabores.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-xl border-primary/25 bg-primary/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">🍕 Puxar sabores do cardápio</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Use as pizzas já cadastradas no cardápio. Nome, preço, promoção e disponibilidade ficam vinculados ao produto real.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading || saving}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando cardápio…
        </div>
      ) : candidates.length === 0 ? (
        <p className="mt-3 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
          Nenhuma pizza disponível foi encontrada. Cadastre ou disponibilize as pizzas no Cardápio antes de sincronizar esta etapa.
        </p>
      ) : (
        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
          {candidates.map((item) => {
            const checked = selected.has(item.id);
            const price = currentPrice(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                  checked ? "border-primary bg-card" : "bg-card/60 hover:border-primary/40"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{item.name}</span>
                  <span className="text-xs font-bold text-primary">{brl(price)}</span>
                </span>
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {checked && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {selected.size} {selected.size === 1 ? "pizza selecionada" : "pizzas selecionadas"}. No pedido, prevalece o maior preço entre os sabores escolhidos.
        </p>
        <Button type="button" size="sm" onClick={sync} disabled={saving || selected.size === 0}>
          {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Sincronizar sabores
        </Button>
      </div>
    </Card>
  );
}
