import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const phoneSchema = z.object({
  phone: z.string().min(8).max(40),
});

function normalize(phone: string) {
  return phone.replace(/\D+/g, "");
}

export const lookupCustomerArea = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => phoneSchema.parse(data))
  .handler(async ({ data }) => {
    const phone = normalize(data.phone);
    if (phone.length < 8) throw new Error("Telefone inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone, total_orders, total_spent, avg_ticket, last_order_at, restaurant_id")
      .eq("phone", phone);

    if (!customers || customers.length === 0) {
      return { found: false as const };
    }

    const restaurantIds = Array.from(new Set(customers.map((c) => c.restaurant_id)));
    const { data: restaurants } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, slug")
      .in("id", restaurantIds);

    // Orders for this phone (raw or formatted variants)
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, items, total, status, address, payment_method, created_at, customer_phone")
      .in("restaurant_id", restaurantIds)
      .order("created_at", { ascending: false })
      .limit(200);

    const filteredOrders = (orders ?? []).filter((o: any) => normalize(o.customer_phone ?? "") === phone);

    // Saved addresses derived from past orders
    const addresses = Array.from(
      new Set((orders ?? []).map((o: any) => o.address).filter(Boolean) as string[]),
    ).slice(0, 5);

    const name = customers[0]?.name ?? "";
    const totalOrders = customers.reduce((s, c) => s + (c.total_orders ?? 0), 0);
    const totalSpent = customers.reduce((s, c) => s + Number(c.total_spent ?? 0), 0);

    return {
      found: true as const,
      profile: { name, phone, totalOrders, totalSpent },
      restaurants: restaurants ?? [],
      orders: filteredOrders,
      addresses,
    };
  });
