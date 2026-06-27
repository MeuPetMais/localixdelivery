import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const ORDER_FIELDS =
  "id, order_number, status, total, discount, items, customer_name, customer_phone, address, payment_method, created_at, updated_at, estimated_delivery_time, restaurant_id";

export const getPublicOrderById = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(ORDER_FIELDS)
      .eq("id", data.id)
      .maybeSingle();
    return { order };
  });

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: orders } = await context.supabase
      .from("orders")
      .select("id, order_number, status, total, items, created_at, restaurant_id, estimated_delivery_time")
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const list = orders ?? [];
    const restaurantIds = Array.from(new Set(list.map((o) => o.restaurant_id)));
    let restaurants: Array<{ id: string; name: string; slug: string; logo_url: string | null }> = [];
    if (restaurantIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rs } = await supabaseAdmin
        .from("restaurants")
        .select("id, name, slug, logo_url")
        .in("id", restaurantIds);
      restaurants = rs ?? [];
    }

    return { orders: list, restaurants };
  });


