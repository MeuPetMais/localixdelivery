import { ledgerIdempotencyKey } from "./ledger-idempotency.ts";
import type { recordMercadoPagoLedger } from "./ledger-idempotency.ts";

type Refund = { id?: string | number | null; amount?: string | number | null } | null;
type Payment = { id: string | number; refunds?: Refund[] | null };
type RefundContext = {
  orderId: string;
  restaurantId: string;
  currency: string;
  correlationId: string;
};
type LedgerEntry = Parameters<typeof recordMercadoPagoLedger>[1];
type LedgerClient = Parameters<typeof recordMercadoPagoLedger>[0];

async function recordRefundLedger(sb: LedgerClient, entry: LedgerEntry): Promise<void> {
  const { data, error: lookupError } = await sb
    .from("financial_ledger")
    .select("id")
    .eq("provider", entry.provider)
    .eq("reference_type", entry.reference_type)
    .eq("reference_id", entry.reference_id)
    .eq("transaction_type", entry.transaction_type)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (data?.id) return;

  const { error } = await sb.from("financial_ledger").insert({
    ...entry,
    metadata: { ...entry.metadata, ledger_idempotency_key: ledgerIdempotencyKey(entry) },
  });
  if (error?.code === "23505") return;
  if (error) throw error;
}

export async function recordPaymentRefunds(
  sb: LedgerClient,
  payment: Payment,
  context: RefundContext,
): Promise<{ recorded: number; incomplete: number }> {
  const refunds = Array.isArray(payment.refunds) ? payment.refunds : [];
  let recorded = 0;
  let incomplete = 0;

  for (const refund of refunds) {
    const refundId = String(refund?.id ?? "").trim();
    const amount = refund?.amount == null ? NaN : Number(refund.amount);
    if (!refundId || !Number.isFinite(amount) || amount <= 0) {
      incomplete++;
      continue;
    }

    await recordRefundLedger(sb, {
      order_id: context.orderId,
      restaurant_id: context.restaurantId,
      provider: "mercado_pago",
      transaction_type: "REFUND",
      amount,
      currency: context.currency,
      status: "COMPLETED",
      reference_type: "mp_refund",
      reference_id: `${String(payment.id)}:refund:${refundId}`,
      description: "Estorno",
      metadata: {
        correlation_id: context.correlationId,
        payment_id: String(payment.id),
        refund_id: refundId,
      },
    });
    recorded++;
  }

  return { recorded, incomplete };
}
