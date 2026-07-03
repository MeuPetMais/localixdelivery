// Server functions do Split — orquestração, EventBus, gravação em payment_split.
// Só admins acionam / listam globalmente. Restaurantes leem apenas os seus (via RLS).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EventBus } from "./EventBus";
import {
  planSplit,
  finalizeSplit,
  type MpAccountState,
  type PaymentState,
  type ReconciliationState,
  type SplitPlan,
  type SplitSnapshot,
} from "./SplitService";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

async function persistAndPublish(
  admin: any,
  plan: SplitPlan,
  splitReference?: string,
) {
  const row = {
    order_id: plan.order_id,
    payment_id: plan.payment_id,
    restaurant_id: plan.restaurant_id,
    provider: plan.provider,
    restaurant_amount: plan.restaurant_amount,
    platform_amount: plan.platform_amount,
    gateway_fee: plan.gateway_fee,
    status: plan.status,
    split_reference: splitReference ?? null,
    error_message: plan.reason ?? null,
    processed_at:
      plan.status === "COMPLETED" || plan.status === "FAILED"
        ? new Date().toISOString()
        : null,
    metadata: plan.reason ? { reason: plan.reason } : {},
  };
  await admin
    .from("payment_split")
    .upsert(row, { onConflict: "order_id" });
}

export const runOrderSplit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ order_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<SplitPlan> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const [orderRes, snapRes, payRes, recRes] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, restaurant_id")
        .eq("id", data.order_id)
        .maybeSingle(),
      supabaseAdmin
        .from("order_pricing_snapshot")
        .select(
          "order_id, restaurant_net, platform_revenue, gateway_fee, currency",
        )
        .eq("order_id", data.order_id)
        .maybeSingle(),
      supabaseAdmin
        .from("order_payment")
        .select("payment_id, status, restaurant_id")
        .eq("order_id", data.order_id)
        .maybeSingle(),
      supabaseAdmin
        .from("payment_reconciliation")
        .select("status")
        .eq("order_id", data.order_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const order = orderRes.data as any;
    const snapRow = snapRes.data as any;
    const payRow = payRes.data as any;
    const recRow = recRes.data as any;

    const restaurantId = order?.restaurant_id ?? payRow?.restaurant_id ?? null;

    const snapshot: SplitSnapshot | null =
      snapRow && restaurantId
        ? {
            order_id: snapRow.order_id,
            restaurant_id: restaurantId,
            restaurant_amount: Number(snapRow.restaurant_net ?? 0),
            platform_amount: Number(snapRow.platform_revenue ?? 0),
            gateway_fee: Number(snapRow.gateway_fee ?? 0),
            currency: snapRow.currency ?? "BRL",
          }
        : null;

    let account: MpAccountState | null = null;
    if (restaurantId) {
      const { data: acc } = await supabaseAdmin
        .from("mercado_pago_accounts")
        .select("restaurant_id, connected, access_token, expires_at")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (acc) {
        const a = acc as any;
        const notExpired =
          !a.expires_at || new Date(a.expires_at).getTime() > Date.now();
        account = {
          connected: Boolean(a.connected),
          active: Boolean(a.connected),
          token_valid: Boolean(a.access_token) && notExpired,
          restaurant_id: a.restaurant_id,
        };
      }
    }

    const reconciliation: ReconciliationState | null = recRow
      ? { status: recRow.status }
      : null;

    const payment: PaymentState | null = payRow
      ? {
          payment_id: payRow.payment_id ?? null,
          approved: payRow.status === "APPROVED" || payRow.status === "approved",
        }
      : null;

    let plan = planSplit({ snapshot, account, reconciliation, payment });

    const evtPayload = (extra: Record<string, any> = {}) => ({
      provider: "mercadopago",
      orderId: plan.order_id,
      restaurantId: plan.restaurant_id,
      paymentId: plan.payment_id,
      amount: plan.restaurant_amount + plan.platform_amount,
      currency: "BRL",
      raw: extra,
    });

    if (plan.status === "PROCESSING") {
      await EventBus.publish("SplitStarted", evtPayload());
      // Execução real via API MP fica no worker/edge function.
      // Aqui persistimos como PROCESSING para o worker consumir.
      await persistAndPublish(supabaseAdmin, plan);
      return plan;
    }

    // Terminal (FAILED / MANUAL_REVIEW) — persiste + publica.
    await persistAndPublish(supabaseAdmin, plan);
    if (plan.status === "FAILED") {
      await EventBus.publish("SplitFailed", evtPayload({ reason: plan.reason }));
    }
    return plan;
  });

/**
 * Marca um split PROCESSING como COMPLETED ou FAILED com base no
 * resultado retornado pelo gateway (chamado pelo worker que integra com MP).
 */
export const completeOrderSplit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        result: z.union([
          z.object({ ok: z.literal(true), split_reference: z.string() }),
          z.object({ ok: z.literal(false), reason: z.string() }),
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: current } = await supabaseAdmin
      .from("payment_split")
      .select("*")
      .eq("order_id", data.order_id)
      .maybeSingle();
    if (!current) throw new Error("split_not_found");

    const plan: SplitPlan = {
      order_id: (current as any).order_id,
      payment_id: (current as any).payment_id,
      restaurant_id: (current as any).restaurant_id,
      provider: "mercadopago",
      restaurant_amount: Number((current as any).restaurant_amount),
      platform_amount: Number((current as any).platform_amount),
      gateway_fee: Number((current as any).gateway_fee),
      status: (current as any).status,
    };

    const next = finalizeSplit(plan, data.result);
    await persistAndPublish(
      supabaseAdmin,
      next,
      data.result.ok ? data.result.split_reference : undefined,
    );

    if (next.status === "COMPLETED") {
      EventBus.publish({
        type: "SplitCompleted",
        order_id: next.order_id!,
        restaurant_id: next.restaurant_id!,
        split_reference: data.result.ok ? data.result.split_reference : "",
      });
    } else if (next.status === "FAILED") {
      EventBus.publish({
        type: "SplitFailed",
        order_id: next.order_id,
        reason: next.reason ?? "unknown",
      });
    }
    return next;
  });

export interface SplitRow {
  id: string;
  order_id: string | null;
  payment_id: string | null;
  restaurant_id: string | null;
  restaurant_amount: number;
  platform_amount: number;
  gateway_fee: number;
  status: string;
  split_reference: string | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
}

const FiltersSchema = z.object({
  limit: z.number().int().min(1).max(500).default(100),
  status: z
    .enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "MANUAL_REVIEW"])
    .optional(),
  restaurant_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const listSplits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    // RLS já limita: admin vê tudo, restaurante vê o próprio.
    let q = context.supabase
      .from("payment_split")
      .select(
        "id, order_id, payment_id, restaurant_id, restaurant_amount, platform_amount, gateway_fee, status, split_reference, error_message, processed_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.restaurant_id) q = q.eq("restaurant_id", data.restaurant_id);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as SplitRow[];
  });

export interface SplitReport {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  failed: number;
  manual_review: number;
  volume_total: number;
  platform_total: number;
  restaurant_total: number;
}

export const getSplitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SplitReport> => {
    await assertAdmin(context);
    const sb = context.supabase;
    const statuses = [
      "COMPLETED",
      "PROCESSING",
      "PENDING",
      "FAILED",
      "MANUAL_REVIEW",
    ] as const;
    const counts = await Promise.all(
      statuses.map((s) =>
        sb
          .from("payment_split")
          .select("*", { count: "exact", head: true })
          .eq("status", s),
      ),
    );
    const { data: sums } = await sb
      .from("payment_split")
      .select("restaurant_amount, platform_amount");
    const platform_total =
      Math.round(
        ((sums ?? []).reduce(
          (a: number, r: any) => a + Number(r.platform_amount ?? 0),
          0,
        )) * 100,
      ) / 100;
    const restaurant_total =
      Math.round(
        ((sums ?? []).reduce(
          (a: number, r: any) => a + Number(r.restaurant_amount ?? 0),
          0,
        )) * 100,
      ) / 100;
    return {
      total: counts.reduce((a, c) => a + (c.count ?? 0), 0),
      completed: counts[0].count ?? 0,
      processing: counts[1].count ?? 0,
      pending: counts[2].count ?? 0,
      failed: counts[3].count ?? 0,
      manual_review: counts[4].count ?? 0,
      volume_total: Math.round((platform_total + restaurant_total) * 100) / 100,
      platform_total,
      restaurant_total,
    };
  });
