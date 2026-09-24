import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canReadCustomer360Restaurant } from "@/lib/customer360-access";
import { normalizeCustomerPhone } from "@/lib/customer360";
import { isOrderGrowthEligible } from "@/lib/orders/order-metrics-contract";
import { summarizeGrowthMeasurement } from "@/lib/customer360-measurement";

const eventSchema = z.object({
  restaurantId: z.string().uuid(),
  customerId: z.string().uuid(),
  eventType: z.enum(["OPPORTUNITY_VIEWED", "ACTION_SELECTED", "ACTION_EXECUTED", "ORDER_ATTRIBUTED"]),
  sourceType: z.string().trim().min(1).max(80),
  sourceRef: z.string().trim().max(120).nullable().optional(),
  actionKey: z.string().trim().max(120).nullable().optional(),
  parentEventId: z.string().uuid().nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

const summarySchema = z.object({
  restaurantId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

async function authorizeRestaurant(userId: string, restaurantId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [restaurantQ, adminRoleQ, growthRoleQ, assignmentQ] = await Promise.all([
    supabaseAdmin.from("restaurants").select("id,owner_id").eq("id", restaurantId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabaseAdmin.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "partner_growth").maybeSingle(),
    supabaseAdmin.from("partner_growth_assignments").select("id")
      .eq("user_id", userId).eq("restaurant_id", restaurantId).eq("active", true).maybeSingle(),
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

async function assertCustomerTenant(sb: any, restaurantId: string, customerId: string) {
  const { data, error } = await sb
    .from("customers")
    .select("id,restaurant_id,phone")
    .eq("id", customerId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Customer not found");
  return data as { id: string; restaurant_id: string; phone: string };
}

export const recordGrowthMeasurementEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sb = await authorizeRestaurant(context.userId, data.restaurantId);
    const customer = await assertCustomerTenant(sb, data.restaurantId, data.customerId);

    let attributedOrderTotal: number | null = null;
    let orderId: string | null = null;

    if (data.eventType === "ORDER_ATTRIBUTED") {
      if (!data.orderId || !data.parentEventId) {
        throw new Error("ORDER_ATTRIBUTED requires orderId and parentEventId");
      }

      const [{ data: parent, error: parentError }, { data: order, error: orderError }] = await Promise.all([
        sb.from("growth_measurement_events")
          .select("id,restaurant_id,customer_id,event_type,occurred_at")
          .eq("id", data.parentEventId)
          .eq("restaurant_id", data.restaurantId)
          .eq("customer_id", data.customerId)
          .maybeSingle(),
        sb.from("orders")
          .select("id,restaurant_id,customer_phone,total,status,created_at")
          .eq("id", data.orderId)
          .eq("restaurant_id", data.restaurantId)
          .maybeSingle(),
      ]);

      if (parentError) throw new Error(parentError.message);
      if (orderError) throw new Error(orderError.message);
      if (!parent || parent.event_type !== "ACTION_EXECUTED") throw new Error("Attribution requires prior ACTION_EXECUTED");
      if (!order) throw new Error("Order not found");
      if (!isOrderGrowthEligible(order.status)) throw new Error("Only realized orders can be attributed");
      if (normalizeCustomerPhone(order.customer_phone) !== normalizeCustomerPhone(customer.phone)) {
        throw new Error("Order does not belong to Customer 360 identity");
      }
      if (new Date(order.created_at).getTime() < new Date(parent.occurred_at).getTime()) {
        throw new Error("Attributed order must occur after the executed action");
      }
      attributedOrderTotal = Math.round(Number(order.total ?? 0) * 100) / 100;
      orderId = order.id;
    } else if (data.orderId) {
      throw new Error("orderId is only valid for ORDER_ATTRIBUTED");
    }

    if (data.eventType !== "OPPORTUNITY_VIEWED" && !data.parentEventId) {
      throw new Error("Non-root measurement events require parentEventId");
    }

    if (data.parentEventId && data.eventType !== "ORDER_ATTRIBUTED") {
      const { data: parent, error } = await sb
        .from("growth_measurement_events")
        .select("id,restaurant_id,customer_id,event_type")
        .eq("id", data.parentEventId)
        .eq("restaurant_id", data.restaurantId)
        .eq("customer_id", data.customerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!parent) throw new Error("Parent measurement event not found");

      const allowedParent =
        (data.eventType === "ACTION_SELECTED" && parent.event_type === "OPPORTUNITY_VIEWED") ||
        (data.eventType === "ACTION_EXECUTED" && parent.event_type === "ACTION_SELECTED");
      if (!allowedParent) throw new Error("Invalid measurement event chain");
    }

    const row = {
      restaurant_id: data.restaurantId,
      customer_id: data.customerId,
      event_type: data.eventType,
      source_type: data.sourceType,
      source_ref: data.sourceRef ?? null,
      action_key: data.actionKey ?? null,
      parent_event_id: data.parentEventId ?? null,
      order_id: orderId,
      attributed_order_total: attributedOrderTotal,
      metadata: data.metadata ?? {},
      idempotency_key: data.idempotencyKey,
    };

    const { data: inserted, error } = await sb
      .from("growth_measurement_events")
      .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (inserted) return inserted;

    const { data: existing, error: existingError } = await sb
      .from("growth_measurement_events")
      .select("*")
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Measurement event could not be resolved");
    return existing;
  });

export const getGrowthMeasurementSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => summarySchema.parse(input))
  .handler(async ({ context, data }) => {
    const sb = await authorizeRestaurant(context.userId, data.restaurantId);
    let query = sb
      .from("growth_measurement_events")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("occurred_at", { ascending: true })
      .limit(5000);
    if (data.from) query = query.gte("occurred_at", data.from);
    if (data.to) query = query.lte("occurred_at", data.to);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return summarizeGrowthMeasurement((rows ?? []) as any);
  });
