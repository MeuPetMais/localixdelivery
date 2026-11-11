import { z } from "zod";
import { jsonObject, toJson } from "@/lib/json";
export const MAX_FINANCIAL_SNAPSHOT_ROWS = 50_000;
const entry = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid().nullable(),
  restaurant_id: z.string().uuid(),
  customer_id: z.string().uuid().nullable(),
  provider: z.string().nullable(),
  transaction_type: z.enum([
    "ORDER_CREATED",
    "PAYMENT_PENDING",
    "PAYMENT_APPROVED",
    "PAYMENT_FAILED",
    "PLATFORM_FEE",
    "GATEWAY_FEE",
    "RESTAURANT_RECEIVABLE",
    "REFUND",
    "CHARGEBACK",
    "PAYOUT",
    "ADJUSTMENT",
  ]),
  reference_type: z.string().nullable(),
  reference_id: z.string().nullable(),
  amount: z.number().finite(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"]),
  description: z.string().nullable(),
  metadata: z.record(z.unknown()).transform((v) => jsonObject(toJson(v))),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
const envelope = z
  .object({
    version: z.literal(1),
    restaurant_id: z.string().uuid(),
    snapshot_at: z.string().datetime({ offset: true }),
    row_count: z.number().int().nonnegative().max(MAX_FINANCIAL_SNAPSHOT_ROWS),
    complete: z.literal(true),
    entries: z.array(entry).max(MAX_FINANCIAL_SNAPSHOT_ROWS),
  })
  .strict();
export type FinancialSnapshot = z.infer<typeof envelope>;
/** Scalar JSON RPC bypasses row caps; no unsafe offset fallback. */
export async function readFinancialSnapshot(
  fetchSnapshot: () => Promise<unknown>,
  restaurantId: string,
): Promise<FinancialSnapshot> {
  const parsed = envelope.safeParse(await fetchSnapshot());
  if (!parsed.success)
    throw new Error("Financial snapshot unavailable: invalid or incomplete response.");
  const snapshot = parsed.data;
  if (snapshot.restaurant_id !== restaurantId || snapshot.row_count !== snapshot.entries.length)
    throw new Error("Financial snapshot unavailable: tenant or row count mismatch.");
  const ids = new Set<string>(),
    currencies = new Set<string>();
  for (const row of snapshot.entries) {
    if (row.restaurant_id !== restaurantId || ids.has(row.id))
      throw new Error("Financial snapshot unavailable: duplicate entry or tenant mismatch.");
    ids.add(row.id);
    currencies.add(row.currency);
  }
  if (currencies.size > 1)
    throw new Error(
      "Financial snapshot unavailable: multiple currencies require separate accounting.",
    );
  return snapshot;
}
export function snapshotStatement(snapshot: FinancialSnapshot, from?: string, to?: string) {
  const start = from === undefined ? null : timestampTicks(from),
    end = to === undefined ? null : timestampTicks(to);
  if (start !== null && end !== null && start > end)
    throw new Error("Invalid financial statement interval.");
  return snapshot.entries.filter((row) => {
    const time = timestampTicks(row.created_at);
    return (start === null || time >= start) && (end === null || time <= end);
  });
}

/** PostgreSQL timestamps retain microseconds; Date alone silently drops them. */
function timestampTicks(value: string): bigint {
  const milliseconds = Date.parse(value);
  const fraction = /\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/.exec(value)?.[1] ?? "";
  if (!Number.isFinite(milliseconds) || fraction.length > 6)
    throw new Error("Invalid financial statement interval.");
  return BigInt(milliseconds) * 1_000n + BigInt(fraction.slice(3).padEnd(3, "0"));
}
