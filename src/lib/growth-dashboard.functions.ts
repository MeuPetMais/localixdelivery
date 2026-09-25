import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canReadCustomer360Restaurant } from "@/lib/customer360-access";
import { resolveCustomer360LifecycleFromProjection, type Customer360Lifecycle } from "@/lib/customer360";
import { summarizeGrowthMeasurement } from "@/lib/customer360-measurement";

const inputSchema = z.object({
  restaurantId: z.string().uuid(),
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

const CHANNELS = ["EMAIL", "SMS", "WHATSAPP", "PUSH", "IN_APP"] as const;

export const getGrowthDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sb = await authorizeRestaurant(context.userId, data.restaurantId);

    const [customersQ, consentsQ, jobsQ, measurementQ] = await Promise.all([
      sb.from("customers")
        .select("id,name,phone,email,total_orders,total_spent,avg_ticket,last_order_at,created_at,updated_at")
        .eq("restaurant_id", data.restaurantId)
        .gt("total_orders", 0)
        .order("last_order_at", { ascending: false, nullsFirst: false })
        .limit(500),
      sb.from("customer_growth_marketing_consents")
        .select("id,customer_id,channel,granted,captured_at,revoked_at")
        .eq("restaurant_id", data.restaurantId)
        .order("captured_at", { ascending: false })
        .limit(5000),
      sb.from("growth_campaign_automation_jobs")
        .select("id,customer_id,trigger_type,channel,action_key,source_ref,status,reason,scheduled_for,sent_at,created_at")
        .eq("restaurant_id", data.restaurantId)
        .order("created_at", { ascending: false })
        .limit(200),
      sb.from("growth_measurement_events")
        .select("*")
        .eq("restaurant_id", data.restaurantId)
        .order("occurred_at", { ascending: true })
        .limit(5000),
    ]);

    for (const result of [customersQ, consentsQ, jobsQ, measurementQ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const now = new Date();
    const lifecycleCounts: Record<Customer360Lifecycle, number> = {
      NEW: 0,
      AWAITING_SECOND_PURCHASE: 0,
      RECURRING: 0,
      HIGH_VALUE: 0,
      LOYAL: 0,
      AT_RISK: 0,
      INACTIVE: 0,
      REACTIVATED: 0,
    };

    const opportunities = (customersQ.data ?? []).map((customer: any) => {
      const lifecycle = resolveCustomer360LifecycleFromProjection({
        totalOrders: Number(customer.total_orders ?? 0),
        totalSpent: Number(customer.total_spent ?? 0),
        lastOrderAt: customer.last_order_at,
        now,
      });
      lifecycleCounts[lifecycle] += 1;

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        total_orders: Number(customer.total_orders ?? 0),
        total_spent: Number(customer.total_spent ?? 0),
        avg_ticket: Number(customer.avg_ticket ?? 0),
        last_order_at: customer.last_order_at,
        lifecycle,
      };
    });

    const opportunityPriority = opportunities
      .filter((c) => ["AWAITING_SECOND_PURCHASE", "AT_RISK", "INACTIVE", "REACTIVATED", "RECURRING"].includes(c.lifecycle))
      .sort((a, b) => {
        const priority: Record<string, number> = {
          AT_RISK: 0,
          INACTIVE: 1,
          AWAITING_SECOND_PURCHASE: 2,
          REACTIVATED: 3,
          RECURRING: 4,
        };
        return (priority[a.lifecycle] ?? 99) - (priority[b.lifecycle] ?? 99);
      })
      .slice(0, 100);

    const latestConsentByCustomerChannel = new Map<string, any>();
    for (const row of consentsQ.data ?? []) {
      const key = `${row.customer_id}:${row.channel}`;
      if (!latestConsentByCustomerChannel.has(key)) latestConsentByCustomerChannel.set(key, row);
    }

    const consentByChannel = Object.fromEntries(CHANNELS.map((channel) => [channel, { granted: 0, denied: 0 }])) as Record<string, { granted: number; denied: number }>;
    for (const row of latestConsentByCustomerChannel.values()) {
      const active = Boolean(row.granted) && !row.revoked_at;
      consentByChannel[row.channel][active ? "granted" : "denied"] += 1;
    }

    const jobStatusCounts: Record<string, number> = {};
    for (const job of jobsQ.data ?? []) {
      jobStatusCounts[job.status] = (jobStatusCounts[job.status] ?? 0) + 1;
    }

    const providers = Object.fromEntries(
      CHANNELS.map((channel) => [channel, process.env[`GROWTH_${channel}_PROVIDER_ENABLED`] === "true"]),
    );

    return {
      generated_at: new Date().toISOString(),
      customers: {
        total: opportunities.length,
        lifecycle_counts: lifecycleCounts,
        opportunities: opportunityPriority,
      },
      consent: {
        total_current_records: latestConsentByCustomerChannel.size,
        by_channel: consentByChannel,
      },
      automation: {
        status_counts: jobStatusCounts,
        recent_jobs: (jobsQ.data ?? []).slice(0, 50),
        providers,
      },
      measurement: summarizeGrowthMeasurement((measurementQ.data ?? []) as any),
    };
  });
