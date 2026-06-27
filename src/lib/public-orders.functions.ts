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

export const searchOrdersByPhone = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const digits = data.phone.replace(/\D+/g, "");
    if (digits.length < 10) return { orders: [] as any[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, total, items, created_at, restaurant_id, customer_phone")
      .eq("customer_phone", digits)
      .order("created_at", { ascending: false })
      .limit(50);
    return { orders: orders ?? [] };
  });
