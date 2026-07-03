// Server functions para o painel admin de Conciliação Financeira.
// Somente admins. Leitura + acionamento de reconciliação por pedido.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  reconcile,
  summarize,
  type GatewayPayment,
  type InternalSnapshot,
  type ReconciliationResult,
} from "./ReconciliationService";

export interface ReconciliationRow {
  id: string;
  order_id: string | null;
  payment_id: string | null;
  provider: string;
  external_reference: string | null;
  gateway_gross_amount: number | null;
  gateway_fee: number | null;
  platform_fee: number | null;
  restaurant_amount: number | null;
  localix_amount: number | null;
  expected_total: number | null;
  received_total: number | null;
  difference_amount: number | null;
  currency: string;
  status: string;
  reconciled: boolean;
  reconciled_at: string | null;
  created_at: string;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

const FiltersSchema = z.object({
  limit: z.number().int().min(1).max(500).default(100),
  status: z
    .enum(["PENDING", "MATCHED", "DIVERGENT", "FAILED", "MANUAL_REVIEW"])
    .optional(),
  provider: z.string().optional(),
  restaurant_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const listReconciliations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("payment_reconciliation")
      .select(
        "id, order_id, payment_id, provider, external_reference, gateway_gross_amount, gateway_fee, platform_fee, restaurant_amount, localix_amount, expected_total, received_total, difference_amount, currency, status, reconciled, reconciled_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.provider) q = q.eq("provider", data.provider);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ReconciliationRow[];
  });

export interface ReconciliationReport {
  total: number;
  matched: number;
  divergent: number;
  pending: number;
  manual_review: number;
  failed: number;
  total_difference: number;
}

export const getReconciliationReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReconciliationReport> => {
    await assertAdmin(context);
    const sb = context.supabase;
    const statuses = [
      "MATCHED",
      "DIVERGENT",
      "PENDING",
      "MANUAL_REVIEW",
      "FAILED",
    ] as const;
    const results = await Promise.all(
      statuses.map((s) =>
        sb
          .from("payment_reconciliation")
          .select("*", { count: "exact", head: true })
          .eq("status", s),
      ),
    );
    const [
      { count: matched },
      { count: divergent },
      { count: pending },
      { count: manual },
      { count: failed },
    ] = results;
    const { data: diffRows } = await sb
      .from("payment_reconciliation")
      .select("difference_amount")
      .neq("difference_amount", 0);
    const total_difference =
      Math.round(
        ((diffRows ?? []).reduce(
          (a: number, r: { difference_amount: number | null }) =>
            a + Number(r.difference_amount ?? 0),
          0,
        )) * 100,
      ) / 100;
    return {
      total:
        (matched ?? 0) +
        (divergent ?? 0) +
        (pending ?? 0) +
        (manual ?? 0) +
        (failed ?? 0),
      matched: matched ?? 0,
      divergent: divergent ?? 0,
      pending: pending ?? 0,
      manual_review: manual ?? 0,
      failed: failed ?? 0,
      total_difference,
    };
  });

/**
 * Aciona a conciliação de um pedido. Compara snapshot interno vs payload
 * do gateway (fornecido via payload — a busca live no MP é feita pelo
 * WebhookService; aqui apenas comparamos o que já temos armazenado).
 * Nunca altera Ledger, Snapshot, PaymentIntent ou Order.
 */
export const runOrderReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ order_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ReconciliationResult> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const [snapRes, payRes] = await Promise.all([
      supabaseAdmin
        .from("order_pricing_snapshot")
        .select(
          "order_id, customer_total, platform_fee, gateway_fee, restaurant_net, platform_revenue, currency",
        )
        .eq("order_id", data.order_id)
        .maybeSingle(),
      supabaseAdmin
        .from("order_payment")
        .select("payment_id, transaction_amount, payment_intent, external_reference")
        .eq("order_id", data.order_id)
        .maybeSingle(),
    ]);
    const snap = snapRes.data as any;
    const pay = payRes.data as any;

    const snapshot: InternalSnapshot | null = snap
      ? {
          order_id: snap.order_id,
          expected_total: Number(snap.customer_total ?? 0),
          platform_fee: Number(snap.platform_fee ?? 0),
          restaurant_amount: Number(snap.restaurant_net ?? 0),
          localix_amount: Number(snap.platform_revenue ?? 0),
          currency: snap.currency ?? "BRL",
        }
      : null;

    let gateway: GatewayPayment | null = null;
    if (pay?.payment_id) {
      const intent = (pay.payment_intent ?? {}) as any;
      gateway = {
        id: pay.payment_id,
        external_reference: pay.external_reference ?? intent.external_reference ?? data.order_id,
        transaction_amount: Number(
          intent.transaction_amount ?? pay.transaction_amount ?? 0,
        ),
        currency_id: intent.currency_id ?? "BRL",
        fee_details: intent.fee_details ?? null,
        net_received_amount: intent.net_received_amount ?? null,
        status: intent.status ?? null,
      };
    }

    const result = reconcile({ gateway, snapshot });

    await supabaseAdmin.from("payment_reconciliation").insert({
      order_id: result.order_id,
      payment_id: result.payment_id,
      provider: result.provider,
      external_reference: result.external_reference,
      gateway_gross_amount: result.gateway_gross_amount,
      gateway_fee: result.gateway_fee,
      platform_fee: result.platform_fee,
      restaurant_amount: result.restaurant_amount,
      localix_amount: result.localix_amount,
      expected_total: result.expected_total,
      received_total: result.received_total,
      difference_amount: result.difference_amount,
      currency: result.currency,
      status: result.status,
      reconciled: result.reconciled,
      reconciled_at: result.reconciled ? new Date().toISOString() : null,
      metadata: result.reason ? { reason: result.reason } : {},
    });

    return result;
  });

// Re-export pure summarize helper for direct use in tests / dashboards
export { summarize };
