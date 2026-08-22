type LedgerEntry = {
  order_id: string;
  restaurant_id: string | null;
  provider: string;
  transaction_type: string;
  amount: number;
  currency: string;
  status: string;
  reference_type: string;
  reference_id: string;
  description: string;
  metadata: Record<string, unknown>;
};

const IDEMPOTENT_MP_LEDGER_TYPES = new Set([
  "PAYMENT_PENDING",
  "PAYMENT_APPROVED",
  "REFUND",
  "CHARGEBACK",
]);

export function shouldDeduplicateLedgerType(transactionType: string): boolean {
  return IDEMPOTENT_MP_LEDGER_TYPES.has(transactionType);
}

export function ledgerIdempotencyKey(entry: LedgerEntry): string {
  return `${entry.reference_type}:${entry.reference_id}:${entry.transaction_type}`;
}

export async function recordMercadoPagoLedger(
  sb: any,
  entry: LedgerEntry,
): Promise<{ inserted: boolean }> {
  if (!shouldDeduplicateLedgerType(entry.transaction_type)) {
    const { error } = await sb.from("financial_ledger").insert(entry);
    if (error) throw error;
    return { inserted: true };
  }

  const idempotentEntry = {
    ...entry,
    metadata: {
      ...entry.metadata,
      ledger_idempotency_key: ledgerIdempotencyKey(entry),
    },
  };

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
  if (data?.id) return { inserted: false };

  const { error } = await sb.from("financial_ledger").insert(idempotentEntry);
  if (error?.code === "23505") return { inserted: false };
  if (error) throw error;
  return { inserted: true };
}
