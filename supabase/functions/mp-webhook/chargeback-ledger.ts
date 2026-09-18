import { ledgerIdempotencyKey } from "./ledger-idempotency.ts";

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type ChargebackLedgerInput = {
  orderId: string;
  restaurantId: string;
  chargebackId: string;
  paymentId: string;
  amount: number;
  currency: string;
  correlationId: string;
};

export async function recordChargebackLedger(
  sb: SupabaseLike,
  input: ChargebackLedgerInput,
): Promise<void> {
  const referenceType = "mp_chargeback";
  const referenceId = input.chargebackId;
  const transactionType = "CHARGEBACK";

  const { data, error: lookupError } = await sb
    .from("financial_ledger")
    .select("id")
    .eq("provider", "mercado_pago")
    .eq("reference_type", referenceType)
    .eq("reference_id", referenceId)
    .eq("transaction_type", transactionType)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (data?.id) return;

  const entry = {
    order_id: input.orderId,
    restaurant_id: input.restaurantId,
    provider: "mercado_pago",
    transaction_type: transactionType,
    amount: input.amount,
    currency: input.currency,
    status: "COMPLETED",
    reference_type: referenceType,
    reference_id: referenceId,
    description: "Chargeback",
    metadata: {
      correlation_id: input.correlationId,
      chargeback_id: input.chargebackId,
      payment_id: input.paymentId,
    },
  };

  const { error } = await sb.from("financial_ledger").insert({
    ...entry,
    metadata: {
      ...entry.metadata,
      ledger_idempotency_key: ledgerIdempotencyKey(entry),
    },
  });

  if (error?.code === "23505") return;
  if (error) throw error;
}
