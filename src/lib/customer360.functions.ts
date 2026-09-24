import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canReadCustomer360Restaurant } from "@/lib/customer360-access";
import {
  buildCustomer360ReadModel,
  normalizeCustomerPhone,
  resolveCustomer360LifecycleFromProjection,
  type Customer360Customer,
  type Customer360Order,
} from "@/lib/customer360";

const getSchema = z.object({
  restaurantId: z.string().uuid(),
  customerId: z.string().uuid(),
});

const listSchema = z.object({
  restaurantId: z.string().uuid(),
  search: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

async function authorizeRestaurantRead(userId: string, restaurantId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [restaurantQ, adminRoleQ, growthRoleQ, assignmentQ] = await Promise.all([
    supabaseAdmin.from("restaurants").select("id, owner_id").eq("id", restaurantId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabaseAdmin.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "partner_growth").maybeSingle(),
    supabaseAdmin
      .from("partner_growth_assignments")
      .select("id")
      .eq("user_id", userId)
      .eq("restaurant_id", restaurantId)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (restaurantQ.error) throw new Error(restaurantQ.error.message);
  if (!restaurantQ.data) throw new Error("Restaurant not found");

  const allowed = canReadCustomer360Restaurant({
    userId,
    restaurantOwnerId: restaurantQ.data.owner_id,
    isAdmin: Boolean(adminRoleQ.data),
    hasGrowthRole: Boolean(growthRoleQ.data),
    hasActiveGrowthAssignment: Boolean(assignmentQ.data),
  });

  if (!allowed) throw new Error("Forbidden");

  return supabaseAdmin;
}

async function loadOrdersForProjectedCustomer(
  sb: any,
  restaurantId: string,
  normalizedPhone: string,
): Promise<Customer360Order[]> {
  if (!normalizedPhone) return [];

  const pageSize = 500;
  const orders: Customer360Order[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await sb
      .from("orders")
      .select("id,total,created_at,items,payment_method,status,coupon_id,customer_phone")
      .eq("restaurant_id", restaurantId)
      .eq("customer_phone", normalizedPhone)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as Array<Customer360Order & { customer_phone?: string | null }>;
    orders.push(...page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return orders;
}

export const getCustomer360 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => getSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sb = await authorizeRestaurantRead(context.userId, data.restaurantId);

    const { data: customer, error } = await sb
      .from("customers")
      .select("id,restaurant_id,name,phone,email,total_orders,total_spent,avg_ticket,last_order_at,created_at,updated_at")
      .eq("id", data.customerId)
      .eq("restaurant_id", data.restaurantId)
      .gt("total_orders", 0)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!customer) throw new Error("Customer not found");

    const normalizedPhone = normalizeCustomerPhone(customer.phone);
    const orders = await loadOrdersForProjectedCustomer(sb, data.restaurantId, normalizedPhone);

    return buildCustomer360ReadModel(customer as Customer360Customer, orders);
  });

export const listCustomer360 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sb = await authorizeRestaurantRead(context.userId, data.restaurantId);

    let query = sb
      .from("customers")
      .select("id,restaurant_id,name,phone,email,total_orders,total_spent,avg_ticket,last_order_at,created_at,updated_at")
      .eq("restaurant_id", data.restaurantId)
      .gt("total_orders", 0)
      .order("last_order_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);

    if (data.search) {
      const escaped = data.search.replace(/[,%]/g, "");
      query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`);
    }

    const { data: customers, error } = await query;
    if (error) throw new Error(error.message);

    const now = new Date();

    return ((customers ?? []) as Customer360Customer[]).map((customer) => {
      const totalOrders = Number(customer.total_orders ?? 0);
      const totalSpent = Number(customer.total_spent ?? 0);
      const lastOrderAt = customer.last_order_at;
      const daysSinceLastOrder = lastOrderAt
        ? Math.max(0, Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / 86_400_000))
        : null;

      return {
        customer,
        lifecycle: resolveCustomer360LifecycleFromProjection({
          totalOrders,
          totalSpent,
          lastOrderAt,
          now,
        }),
        metrics: {
          total_orders: totalOrders,
          total_spent: totalSpent,
          avg_ticket: Number(customer.avg_ticket ?? 0),
          last_order_at: lastOrderAt,
          days_since_last_order: daysSinceLastOrder,
        },
      };
    });
  });
