import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BenefitRestaurant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

export type BenefitCoupon = {
  id: string;
  code: string;
  discountPercent: number;
  validUntil: string | null;
  restaurant: BenefitRestaurant;
};

export type BenefitPromotion = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  promoPrice: number;
  promoEndsAt: string | null;
  restaurant: BenefitRestaurant;
};

export type BenefitLoyalty = {
  restaurant: BenefitRestaurant;
  ordersCount: number;
  goal: number;
};

export type BenefitsPayload = {
  restaurants: BenefitRestaurant[];
  coupons: BenefitCoupon[];
  promotions: BenefitPromotion[];
  loyalty: BenefitLoyalty[];
  points: { total: number };
};

export const getMyBenefits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BenefitsPayload> => {
    const { supabase, userId } = context;

    // 1. Get restaurants the customer has relationship with (via orders)
    const { data: orderRows } = await supabase
      .from("orders")
      .select("restaurant_id")
      .eq("customer_id", userId);

    const restaurantIds = Array.from(
      new Set((orderRows ?? []).map((o: any) => o.restaurant_id).filter(Boolean)),
    );

    // Per-restaurant order counts (for loyalty)
    const countsByRestaurant = new Map<string, number>();
    (orderRows ?? []).forEach((o: any) => {
      countsByRestaurant.set(o.restaurant_id, (countsByRestaurant.get(o.restaurant_id) ?? 0) + 1);
    });

    // 2. Points (sum across restaurants)
    const { data: pts } = await supabase
      .from("customer_loyalty")
      .select("points_balance")
      .eq("customer_id", userId);

    const pointsTotal = ((pts ?? []) as Array<{ points_balance: number | null }>)
      .reduce((sum, r) => sum + (Number(r.points_balance) || 0), 0);

    if (restaurantIds.length === 0) {
      return {
        restaurants: [],
        coupons: [],
        promotions: [],
        loyalty: [],
        points: { total: pointsTotal },
      };
    }


    // 3. Fetch restaurants, active coupons, active promotions in parallel
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [restRes, couponsRes, promosRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("restaurants_public")
        .select("id, name, slug, logo_url")
        .in("id", restaurantIds),
      supabaseAdmin
        .from("coupons")
        .select("id, code, discount_percent, valid_until, is_active, restaurant_id")
        .in("restaurant_id", restaurantIds)
        .eq("is_active", true),
      supabaseAdmin
        .from("menu_items")
        .select(
          "id, name, description, image_url, price, promo_price, promo_ends_at, is_available, is_active, is_paused, restaurant_id",
        )
        .in("restaurant_id", restaurantIds)
        .eq("is_active", true)
        .eq("is_available", true)
        .not("promo_price", "is", null),
    ]);

    const restList: BenefitRestaurant[] = (restRes.data ?? []) as any[];
    const restMap = new Map<string, BenefitRestaurant>(restList.map((r) => [r.id, r]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const coupons: BenefitCoupon[] = ((couponsRes.data ?? []) as any[])
      .filter((c) => !c.valid_until || new Date(c.valid_until) >= today)
      .map((c) => ({
        id: c.id,
        code: c.code,
        discountPercent: c.discount_percent,
        validUntil: c.valid_until,
        restaurant: restMap.get(c.restaurant_id)!,
      }))
      .filter((c) => !!c.restaurant);

    const now = Date.now();
    const promotions: BenefitPromotion[] = ((promosRes.data ?? []) as any[])
      .filter((p) => {
        if (p.is_paused) return false;
        const price = Number(p.price);
        const promo = p.promo_price == null ? null : Number(p.promo_price);
        if (!promo || promo <= 0 || promo >= price) return false;
        if (p.promo_ends_at && new Date(p.promo_ends_at).getTime() < now) return false;
        return true;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.image_url,
        price: Number(p.price),
        promoPrice: Number(p.promo_price),
        promoEndsAt: p.promo_ends_at,
        restaurant: restMap.get(p.restaurant_id)!,
      }))
      .filter((p) => !!p.restaurant);

    const loyalty: BenefitLoyalty[] = restList.map((r) => ({
      restaurant: r,
      ordersCount: countsByRestaurant.get(r.id) ?? 0,
      goal: 10,
    }));

    return {
      restaurants: restList,
      coupons,
      promotions,
      loyalty,
      points: { total: pointsTotal },
    };
  });
