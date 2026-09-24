import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canReadCustomer360Restaurant } from "@/lib/customer360-access";
import { planGrowthCampaignAutomation } from "@/lib/customer360-campaign-automation";
import {
  buildCustomer360ReadModel,
  normalizeCustomerPhone,
  type Customer360Customer,
  type Customer360Order,
} from "@/lib/customer360";
import { buildCustomer360Intelligence } from "@/lib/customer360-intelligence";

const planSchema = z.object({
  restaurantId: z.string().uuid(),
  customerId: z.string().uuid(),
  channel: z.enum(["EMAIL","SMS","WHATSAPP","PUSH","IN_APP"]),
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

function providerAvailable(channel: string) {
  const envKey = `GROWTH_${channel}_PROVIDER_ENABLED`;
  return process.env[envKey] === "true";
}

export const planAndQueueGrowthCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sb = await authorizeRestaurant(context.userId, data.restaurantId);

    const [{ data: consent, error: consentError }, { data: recentJobs, error: jobsError }] = await Promise.all([
      sb.from("customer_growth_marketing_consents")
        .select("id,channel,granted,captured_at,revoked_at")
        .eq("restaurant_id", data.restaurantId)
        .eq("customer_id", data.customerId)
        .eq("channel", data.channel)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from("growth_campaign_automation_jobs")
        .select("trigger_type,channel,created_at,status")
        .eq("restaurant_id", data.restaurantId)
        .eq("customer_id", data.customerId)
        .eq("channel", data.channel)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (consentError) throw new Error(consentError.message);
    if (jobsError) throw new Error(jobsError.message);

    const { data: customer, error: customerError } = await sb
      .from("customers")
      .select("id,restaurant_id,name,phone,email,total_orders,total_spent,avg_ticket,last_order_at,created_at,updated_at")
      .eq("id", data.customerId)
      .eq("restaurant_id", data.restaurantId)
      .gt("total_orders", 0)
      .maybeSingle();
    if (customerError) throw new Error(customerError.message);
    if (!customer) throw new Error("Customer not found");

    const normalizedPhone = normalizeCustomerPhone(customer.phone);
    const orders: Customer360Order[] = [];
    const pageSize = 500;
    let from = 0;
    while (true) {
      const { data: page, error: ordersError } = await sb
        .from("orders")
        .select("id,total,created_at,items,payment_method,status,coupon_id,customer_phone")
        .eq("restaurant_id", data.restaurantId)
        .eq("customer_phone", normalizedPhone)
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (ordersError) throw new Error(ordersError.message);
      const rows = (page ?? []) as Array<Customer360Order & { customer_phone?: string | null }>;
      orders.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    const customer360 = buildCustomer360ReadModel(customer as Customer360Customer, orders);
    const intelligence = buildCustomer360Intelligence(customer360);

    const plan = planGrowthCampaignAutomation({
      customer360,
      insights: intelligence,
      channel: data.channel,
      latestConsent: consent as any,
      providerAvailable: providerAvailable(data.channel),
      recentJobs: (recentJobs ?? []) as any,
    });

    if (!plan) {
      return { created: false, plan: null };
    }

    const dayBucket = new Date().toISOString().slice(0, 10);
    const idempotencyKey = [
      data.restaurantId,
      data.customerId,
      plan.trigger_type,
      data.channel,
      dayBucket,
    ].join(":");

    const row = {
      restaurant_id: data.restaurantId,
      customer_id: data.customerId,
      trigger_type: plan.trigger_type,
      channel: data.channel,
      action_key: plan.action_key,
      source_ref: plan.source_ref,
      status: plan.status,
      reason: plan.reason,
      consent_id: plan.consent_id,
      idempotency_key: idempotencyKey,
      metadata: {
        lifecycle: customer360.lifecycle,
        metric_time_basis: customer360.metric_time_basis,
      },
    };

    const { data: inserted, error } = await sb
      .from("growth_campaign_automation_jobs")
      .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true })
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (inserted) return { created: true, plan, job: inserted };

    const { data: existing, error: existingError } = await sb
      .from("growth_campaign_automation_jobs")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    return { created: false, plan, job: existing };
  });
