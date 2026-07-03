import { supabase } from "@/integrations/supabase/client";
import { CustomerEventBus } from "./CustomerEventBus";

const T = () => (supabase as any).from("customer_favorites");

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
    if (targetType) q = q.eq("target_type", targetType);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as FavoriteRecord[];
  },

  async add(customerId: string, targetType: FavoriteTargetType, targetId: string): Promise<void> {
    const { error } = await T().insert({ customer_id: customerId, target_type: targetType, target_id: targetId });
    if (error && !String(error.message ?? "").includes("duplicate")) throw error;
    await CustomerEventBus.publish({
      type: "FavoriteAdded", customerId, targetType, targetId, at: new Date().toISOString(),
    });
  },

  async remove(customerId: string, targetType: FavoriteTargetType, targetId: string): Promise<void> {
    const { error } = await T().delete()
      .eq("customer_id", customerId).eq("target_type", targetType).eq("target_id", targetId);
    if (error) throw error;
    await CustomerEventBus.publish({
      type: "FavoriteRemoved", customerId, targetType, targetId, at: new Date().toISOString(),
    });
  },
} as const;
