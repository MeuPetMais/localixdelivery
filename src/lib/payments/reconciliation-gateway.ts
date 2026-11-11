import type { Tables } from "@/integrations/supabase/types";
import type { GatewayPayment } from "./ReconciliationService";
/** order_payment.payment_intent is a TEXT identifier, not a gateway JSON response. */
export function gatewayFromStoredPayment(
  pay: Pick<
    Tables<"order_payment">,
    "payment_id" | "external_reference" | "payment_intent" | "transaction_amount"
  > | null,
  orderId: string,
): GatewayPayment | null {
  if (!pay?.payment_id) return null;
  return {
    id: pay.payment_id,
    external_reference: pay.external_reference ?? orderId,
    transaction_amount: Number(pay.transaction_amount ?? 0),
    currency_id: "BRL",
    fee_details: null,
    net_received_amount: null,
    status: null,
  };
}
