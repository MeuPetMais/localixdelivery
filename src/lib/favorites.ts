import { supabase } from "@/integrations/supabase/client";

export type FavoriteKind = "menu_item" | "builder";

export type FavoriteRow = {
  id: string;
  restaurant_id: string;
  item_kind: FavoriteKind;
  item_id: string;
  created_at: string;
};

export type EnrichedFavorite = {
  id: string;
  createdAt: string;
  kind: FavoriteKind;
  itemId: string;
  available: boolean;
  // product data (may be null if removed)
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  promoPrice: number | null;
  categoryName: string | null;
  // restaurant
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  restaurantLogo: string | null;
};

/** All favorite item ids for a given restaurant (for the current user). */
export async function fetchFavoriteIdsForRestaurant(restaurantId: string) {
  const { data } = await supabase
    .from("customer_favorites")
    .select("item_kind, item_id")
    .eq("restaurant_id", restaurantId);
  const items = new Set<string>();
  const builders = new Set<string>();
  (data ?? []).forEach((r: any) => {
    if (r.item_kind === "menu_item") items.add(r.item_id);
    else builders.add(r.item_id);
  });
  return { items, builders };
}

export async function toggleFavorite(input: {
  restaurantId: string;
  kind: FavoriteKind;
  itemId: string;
}) {
  const { data: existing } = await supabase
    .from("customer_favorites")
    .select("id")
    .eq("restaurant_id", input.restaurantId)
    .eq("item_kind", input.kind)
    .eq("item_id", input.itemId)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("customer_favorites").delete().eq("id", existing.id);
    return { favorited: false };
  }

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Você precisa estar logado.");

  const { error } = await supabase.from("customer_favorites").insert({
    customer_id: u.user.id,
    restaurant_id: input.restaurantId,
    item_kind: input.kind,
    item_id: input.itemId,
  });
  if (error) throw error;
  return { favorited: true };
}

/** Loads all favorites for the current user and enriches them with up-to-date product/restaurant data. */
export async function listMyFavoritesEnriched(): Promise<EnrichedFavorite[]> {
  const { data: rows, error } = await supabase
    .from("customer_favorites")
    .select("id, restaurant_id, item_kind, item_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const favs = (rows ?? []) as FavoriteRow[];
  if (favs.length === 0) return [];

  const restaurantIds = [...new Set(favs.map((f) => f.restaurant_id))];
  const menuIds = favs.filter((f) => f.item_kind === "menu_item").map((f) => f.item_id);
  const builderIds = favs.filter((f) => f.item_kind === "builder").map((f) => f.item_id);

  const [restRes, itemRes, builderRes] = await Promise.all([
    (supabase as any)
      .from("restaurants_public")
      .select("id, name, slug, logo_url")
      .in("id", restaurantIds),
    menuIds.length
      ? supabase
          .from("menu_items")
          .select("id, name, description, image_url, price, promo_price, is_available, is_active, category_id")
          .in("id", menuIds)
      : Promise.resolve({ data: [] as any[] }),
    builderIds.length
      ? (supabase as any)
          .from("builders")
          .select("id, name, description, image_url, base_price, is_active")
          .in("id", builderIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const categoryIds = [
    ...new Set(((itemRes as any).data ?? []).map((i: any) => i.category_id).filter(Boolean)),
  ] as string[];
  const catRes = categoryIds.length
    ? await supabase.from("menu_categories").select("id, name").in("id", categoryIds)
    : { data: [] as any[] };

  const restMap = new Map<string, any>(((restRes as any).data ?? []).map((r: any) => [r.id, r]));
  const itemMap = new Map<string, any>(((itemRes as any).data ?? []).map((r: any) => [r.id, r]));
  const builderMap = new Map<string, any>(((builderRes as any).data ?? []).map((r: any) => [r.id, r]));
  const catMap = new Map<string, any>(((catRes as any).data ?? []).map((r: any) => [r.id, r]));

  return favs
    .map((f) => {
      const rest = restMap.get(f.restaurant_id);
      if (!rest) return null;
      if (f.item_kind === "menu_item") {
        const it = itemMap.get(f.item_id);
        const available = !!it && it.is_active !== false && it.is_available !== false;
        return {
          id: f.id,
          createdAt: f.created_at,
          kind: "menu_item" as const,
          itemId: f.item_id,
          available,
          name: it?.name ?? null,
          description: it?.description ?? null,
          imageUrl: it?.image_url ?? null,
          price: it ? Number(it.price) : null,
          promoPrice: it?.promo_price != null ? Number(it.promo_price) : null,
          categoryName: it?.category_id ? catMap.get(it.category_id)?.name ?? null : null,
          restaurantId: rest.id,
          restaurantName: rest.name,
          restaurantSlug: rest.slug,
          restaurantLogo: rest.logo_url ?? null,
        };
      }
      const b = builderMap.get(f.item_id);
      const available = !!b && b.is_active !== false;
      return {
        id: f.id,
        createdAt: f.created_at,
        kind: "builder" as const,
        itemId: f.item_id,
        available,
        name: b?.name ?? null,
        description: b?.description ?? null,
        imageUrl: b?.image_url ?? null,
        price: b?.base_price != null ? Number(b.base_price) : null,
        promoPrice: null,
        categoryName: "Monte do seu jeito",
        restaurantId: rest.id,
        restaurantName: rest.name,
        restaurantSlug: rest.slug,
        restaurantLogo: rest.logo_url ?? null,
      };
    })
    .filter(Boolean) as EnrichedFavorite[];
}
