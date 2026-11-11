import type { JsonObject } from "@/lib/json";
// LedgerService — Livro razão financeiro (append-only).
// Regra de ouro: NUNCA modificar registros. Sempre criar novos lançamentos.
// Componentes React NÃO devem acessar `financial_ledger` diretamente —
// sempre passe por este serviço (server functions).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readFinancialSnapshot, snapshotStatement } from "./financial-statement-pagination";

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
  metadata: JsonObject;
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
  metadata?: JsonObject;
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
  /** Both gross payments and receivables exist; the posting basis is ambiguous. */
  ambiguousPostingBasis: boolean;
}

// ------------- Núcleo puro (testável) -------------
// Regras de sinal para cálculo de saldo do restaurante.
// Positivo => entra para o restaurante; Negativo => sai.
export function signedAmount(
  entry: Pick<LedgerEntry, "transaction_type" | "amount" | "status">,
): number {
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
    ambiguousPostingBasis:
      scoped.some((e) => e.status === "COMPLETED" && e.transaction_type === "PAYMENT_APPROVED") &&
      scoped.some(
        (e) => e.status === "COMPLETED" && e.transaction_type === "RESTAURANT_RECEIVABLE",
      ),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// Financial ledger writes are performed only by the existing trusted gateway workers.
// The unused public admin-backed recordLedgerEntry endpoint was removed (Gate 4).

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
    z
      .object({
        restaurantId: z.string().uuid(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(d),
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

/** One RLS-scoped SQL statement supplies both all-time balance and filtered statement. */
export const getRestaurantFinancialSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        restaurantId: z.string().uuid(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const snapshot = await readFinancialSnapshot(async () => {
      const { data: payload, error } = await context.supabase.rpc(
        "get_restaurant_financial_snapshot",
        { _restaurant_id: data.restaurantId },
      );
      if (error) throw new Error("Financial snapshot unavailable: " + error.message);
      return payload;
    }, data.restaurantId);
    return {
      rows: snapshotStatement(snapshot, data.from, data.to),
      balance: computeBalance(snapshot.entries, data.restaurantId),
      snapshotAt: snapshot.snapshot_at,
    };
  });

/** Complete statement, retained for external read consumers. */
export const getRestaurantFinancialStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        restaurantId: z.string().uuid(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => (await getRestaurantFinancialSnapshot({ data })).rows);

export const getRestaurantBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => (await getRestaurantFinancialSnapshot({ data })).balance);
