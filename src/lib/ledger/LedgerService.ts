// LedgerService — Livro razão financeiro (append-only).
// Regra de ouro: NUNCA modificar registros. Sempre criar novos lançamentos.
// Componentes React NÃO devem acessar `financial_ledger` diretamente —
// sempre passe por este serviço (server functions).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ------------- Tipos -------------
export type LedgerTransactionType =
  | "ORDER_CREATED"
  | "PAYMENT_PENDING"
  | "PAYMENT_APPROVED"
  | "PAYMENT_FAILED"
  | "PLATFORM_FEE"
  | "GATEWAY_FEE"
  | "RESTAURANT_RECEIVABLE"
  | "REFUND"
  | "CHARGEBACK"
  | "PAYOUT"
  | "ADJUSTMENT";

export type LedgerStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface LedgerEntry {
  id: string;
  order_id: string | null;
  restaurant_id: string | null;
  customer_id: string | null;
  provider: string | null;
  transaction_type: LedgerTransactionType;
  reference_type: string | null;
  reference_id: string | null;
  amount: number;
  currency: string;
  status: LedgerStatus;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LedgerRecordInput {
  orderId?: string | null;
  restaurantId?: string | null;
  customerId?: string | null;
  provider?: string | null;
  transactionType: LedgerTransactionType;
  referenceType?: string | null;
  referenceId?: string | null;
  amount: number;
  currency?: string;
  status?: LedgerStatus;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface BalanceSummary {
  restaurantId: string;
  currency: string;
  receivable: number;
  platformFees: number;
  gatewayFees: number;
  refunds: number;
  payouts: number;
  netBalance: number;
  entriesCount: number;
}

// ------------- Núcleo puro (testável) -------------
// Regras de sinal para cálculo de saldo do restaurante.
// Positivo => entra para o restaurante; Negativo => sai.
export function signedAmount(entry: Pick<LedgerEntry, "transaction_type" | "amount" | "status">): number {
  if (entry.status !== "COMPLETED") return 0;
  const a = Number(entry.amount) || 0;
  switch (entry.transaction_type) {
    case "RESTAURANT_RECEIVABLE":
    case "PAYMENT_APPROVED":
    case "ADJUSTMENT":
      return a;
    case "PLATFORM_FEE":
    case "GATEWAY_FEE":
    case "REFUND":
    case "CHARGEBACK":
    case "PAYOUT":
      return -Math.abs(a);
    default:
      return 0;
  }
}

export function computeBalance(entries: LedgerEntry[], restaurantId: string): BalanceSummary {
  const scoped = entries.filter((e) => e.restaurant_id === restaurantId);
  const sum = (t: LedgerTransactionType) =>
    scoped
      .filter((e) => e.transaction_type === t && e.status === "COMPLETED")
      .reduce((s, e) => s + Number(e.amount || 0), 0);

  const receivable = sum("RESTAURANT_RECEIVABLE");
  const platformFees = sum("PLATFORM_FEE");
  const gatewayFees = sum("GATEWAY_FEE");
  const refunds = sum("REFUND") + sum("CHARGEBACK");
  const payouts = sum("PAYOUT");
  const netBalance = scoped.reduce((s, e) => s + signedAmount(e), 0);

  return {
    restaurantId,
    currency: scoped[0]?.currency ?? "BRL",
    receivable: round2(receivable),
    platformFees: round2(platformFees),
    gatewayFees: round2(gatewayFees),
    refunds: round2(refunds),
    payouts: round2(payouts),
    netBalance: round2(netBalance),
    entriesCount: scoped.length,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ------------- Server API -------------
const recordSchema = z.object({
  orderId: z.string().uuid().nullable().optional(),
  restaurantId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  provider: z.string().nullable().optional(),
  transactionType: z.enum([
    "ORDER_CREATED","PAYMENT_PENDING","PAYMENT_APPROVED","PAYMENT_FAILED",
    "PLATFORM_FEE","GATEWAY_FEE","RESTAURANT_RECEIVABLE",
    "REFUND","CHARGEBACK","PAYOUT","ADJUSTMENT",
  ]),
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().nullable().optional(),
  amount: z.number().finite(),
  currency: z.string().default("BRL"),
  status: z.enum(["PENDING","COMPLETED","FAILED","CANCELLED"]).default("COMPLETED"),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
});

/**
 * Registra um novo lançamento (uso interno de outros server services:
 * PaymentService, OrderService, Webhooks de gateway, jobs de payout).
 */
export const recordLedgerEntry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => recordSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("financial_ledger")
      .insert({
        order_id: data.orderId ?? null,
        restaurant_id: data.restaurantId ?? null,
        customer_id: data.customerId ?? null,
        provider: data.provider ?? null,
        transaction_type: data.transactionType,
        reference_type: data.referenceType ?? null,
        reference_id: data.referenceId ?? null,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        description: data.description ?? null,
        metadata: data.metadata ?? {},
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as LedgerEntry;
  });

/** Histórico completo por pedido (todas as movimentações vinculadas). */
export const getOrderLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("financial_ledger")
      .select("*")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as LedgerEntry[];
  });

/** Extrato de um restaurante em uma janela de datas. */
export const getRestaurantStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      restaurantId: z.string().uuid(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("financial_ledger")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as LedgerEntry[];
  });

/** Saldo consolidado do restaurante (a partir do extrato completo). */
export const getRestaurantBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("financial_ledger")
      .select("*")
      .eq("restaurant_id", data.restaurantId);
    if (error) throw new Error(error.message);
    return computeBalance((rows ?? []) as LedgerEntry[], data.restaurantId);
  });
