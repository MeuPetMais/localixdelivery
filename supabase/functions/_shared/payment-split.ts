import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type PaymentSplitStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "MANUAL_REVIEW";

export type PaymentSplitRow = {
  order_id: string;
  payment_id: string | null;
  restaurant_id: string;
  provider: string;
  restaurant_amount: number;
  platform_amount: number;
  gateway_fee: number;
  status: PaymentSplitStatus;
  split_reference: string | null;
  error_message?: string | null;
  processed_at?: string | null;
  metadata?: Record<string, unknown>;
};

type SupabaseWriteError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function uniqueViolation(error: SupabaseWriteError | null | undefined): boolean {
  return error?.code === "23505" || /duplicate key value/i.test(String(error?.message ?? ""));
}

function syntheticError(message: string): SupabaseWriteError {
  return { code: "payment_split_persist_failed", message };
}

async function updatePaymentSplitById(sb: SupabaseClient, id: string, row: PaymentSplitRow) {
  const { data, error } = await sb
    .from("payment_split")
    .update(row)
    .eq("id", id)
    .select("id");
  if (error) return { error };
  if (!data || data.length === 0) return { error: syntheticError("payment_split_update_no_rows") };
  return { error: null };
}

async function updatePaymentSplitByOrder(sb: SupabaseClient, row: PaymentSplitRow) {
  const { data, error } = await sb
    .from("payment_split")
    .update(row)
    .eq("order_id", row.order_id)
    .select("id");
  if (error) return { error };
  if (!data || data.length === 0) return { error: syntheticError("payment_split_update_no_rows") };
  return { error: null };
}

export async function persistPaymentSplitByOrder(sb: SupabaseClient, row: PaymentSplitRow) {
  if (!row.order_id) return { error: syntheticError("payment_split_order_id_required") };

  const { data: existing, error: selectError } = await sb
    .from("payment_split")
    .select("id")
    .eq("order_id", row.order_id)
    .maybeSingle();
  if (selectError) return { error: selectError };

  const existingId = typeof existing?.id === "string" ? existing.id : null;
  if (existingId) return await updatePaymentSplitById(sb, existingId, row);

  const { error: insertError } = await sb.from("payment_split").insert(row);
  if (!insertError) return { error: null };
  if (uniqueViolation(insertError)) return await updatePaymentSplitByOrder(sb, row);
  return { error: insertError };
}

export async function persistPaymentSplitByOrderOrThrow(
  sb: SupabaseClient,
  row: PaymentSplitRow,
  errorCode = "payment_split_persist_failed",
) {
  const { error } = await persistPaymentSplitByOrder(sb, row);
  if (error) throw new Error(error.message ?? errorCode);
}
