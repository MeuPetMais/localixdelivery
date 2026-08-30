import { supabase } from "@/integrations/supabase/client";
import { isPromoActiveNow } from "@/lib/promotions";
import type { ProductOption } from "@/lib/product/configuration/types";
import type { ChefRecommendationCandidate } from "../types";

type MenuItemRow = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
  recurrence_days: number[] | null;
  recurrence_start_time: string | null;
  recurrence_end_time: string | null;
  is_active: boolean | null;
  is_available: boolean | null;
  is_paused: boolean | null;
  is_bestseller: boolean | null;
  is_featured: boolean | null;
  is_weekly_favorite: boolean | null;
};

type CategoryRow = { id: string; restaurant_id: string; name: string };
type OptionGroupRow = { id: string; product_id: string; restaurant_id: string };

type SupabaseLike = typeof supabase;

export interface ChefCatalogService {
  listRecommendationCandidates(input: {
    restaurantId: string;
    now?: Date;
  }): Promise<ChefRecommendationCandidate[]>;
}

export function createChefCatalogService(client: SupabaseLike = supabase): ChefCatalogService {
  return {
    async listRecommendationCandidates({ restaurantId, now = new Date() }) {
      const [itemsResult, categoriesResult, groupsResult] = await Promise.all([
        client
          .from("menu_items")
          .select(
            "id, restaurant_id, category_id, name, description, price, promo_price, promo_starts_at, promo_ends_at, recurrence_days, recurrence_start_time, recurrence_end_time, is_active, is_available, is_paused, is_bestseller, is_featured, is_weekly_favorite",
          )
          .eq("restaurant_id", restaurantId),
        client
          .from("menu_categories")
          .select("id, restaurant_id, name")
          .eq("restaurant_id", restaurantId),
        client
          .from("product_option_groups")
          .select("id, product_id, restaurant_id")
          .eq("restaurant_id", restaurantId),
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (groupsResult.error) throw groupsResult.error;

      const items = (itemsResult.data ?? []) as MenuItemRow[];
      const categories = (categoriesResult.data ?? []) as CategoryRow[];
      const groups = (groupsResult.data ?? []) as OptionGroupRow[];
      const categoryById = new Map(categories.map((category) => [category.id, category.name]));
      const groupIds = groups.map((group) => group.id);
      const productIdByGroupId = new Map(groups.map((group) => [group.id, group.product_id]));

      let optionTermsByProductId = new Map<string, string[]>();
      if (groupIds.length > 0) {
        const optionsResult = await client
          .from("product_options")
          .select("group_id, name, description, active")
          .in("group_id", groupIds)
          .eq("active", true);
        if (optionsResult.error) throw optionsResult.error;

        for (const option of (optionsResult.data ?? []) as Pick<
          ProductOption,
          "group_id" | "name" | "description" | "active"
        >[]) {
          const productId = productIdByGroupId.get(option.group_id);
          if (!productId) continue;
          const terms = optionTermsByProductId.get(productId) ?? [];
          terms.push(option.name);
          if (option.description) terms.push(option.description);
          optionTermsByProductId.set(productId, terms);
        }
      }

      return items.map((item) => {
        const promotionActive = isPromoActiveNow(item, now);
        return {
          productId: item.id,
          restaurantId: item.restaurant_id,
          name: item.name,
          description: item.description,
          category: item.category_id ? categoryById.get(item.category_id) ?? null : null,
          regularPrice: Number(item.price),
          effectivePrice: promotionActive ? Number(item.promo_price) : Number(item.price),
          promotionActive,
          isActive: item.is_active !== false,
          isAvailable: item.is_available !== false,
          isPaused: item.is_paused === true,
          isBestseller: item.is_bestseller === true,
          isFeatured: item.is_featured === true,
          isWeeklyFavorite: item.is_weekly_favorite === true,
          optionTerms: [...new Set(optionTermsByProductId.get(item.id) ?? [])],
        } satisfies ChefRecommendationCandidate;
      });
    },
  };
}
