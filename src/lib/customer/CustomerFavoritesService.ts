import { supabase } from "@/integrations/supabase/client";
import { CustomerEventBus } from "./CustomerEventBus";

const T = () => supabase.from("customer_favorites");

export type FavoriteTargetType = "product" | "restaurant" | "category";

export type FavoriteRecord = {
  id: string;
  customer_id: string;
  target_type: FavoriteTargetType;
  target_id: string;
  created_at: string;
};

export const CustomerFavoritesService = {
  async list(customerId: string, targetType?: FavoriteTargetType): Promise<FavoriteRecord[]> {
    let q = T().select("*").eq("customer_id", customerId).order("created_at", { ascending: false });
    if (targetType && targetType !== "product") return [];
    q = q.eq("item_kind", "menu_item");
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      customer_id: row.customer_id,
      target_type: "product",
      target_id: row.item_id,
      created_at: row.created_at,
    }));
  },

  async add(customerId: string, targetType: FavoriteTargetType, targetId: string): Promise<void> {
    if (targetType !== "product")
      throw new Error("Only product favorites are supported by the current schema");
    const { data: item, error: itemError } = await supabase
      .from("menu_items")
      .select("restaurant_id")
      .eq("id", targetId)
      .single();
    if (itemError) throw itemError;
    const { error } = await T().insert({
      customer_id: customerId,
      restaurant_id: item.restaurant_id,
      item_kind: "menu_item",
      item_id: targetId,
    });
    if (error && !String(error.message ?? "").includes("duplicate")) throw error;
    await CustomerEventBus.publish({
      type: "FavoriteAdded",
      customerId,
      targetType,
      targetId,
      at: new Date().toISOString(),
    });
  },

  async remove(
    customerId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void> {
    if (targetType !== "product")
      throw new Error("Only product favorites are supported by the current schema");
    const { error } = await T()
      .delete()
      .eq("customer_id", customerId)
      .eq("item_kind", "menu_item")
      .eq("item_id", targetId);
    if (error) throw error;
    await CustomerEventBus.publish({
      type: "FavoriteRemoved",
      customerId,
      targetType,
      targetId,
      at: new Date().toISOString(),
    });
  },
} as const;
