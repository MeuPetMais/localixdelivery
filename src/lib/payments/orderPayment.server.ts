// Server-only facade of the Payment Domain for order-scoped writes.
// Keeps checkout/OrderService free of direct `order_payment` table access.
// Do NOT import from browser-reachable modules.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface RegisterPendingOrderPaymentInput {
  orderId: string;
  restaurantId: string;
  paymentMethod: string;
  provider?: string;
  externalReference?: string;
}

export async function registerPendingOrderPayment(input: RegisterPendingOrderPaymentInput) {
  const { error } = await supabaseAdmin.from("order_payment").insert({
    order_id: input.orderId,
    restaurant_id: input.restaurantId,
    provider: input.provider ?? "mercado_pago",
    payment_method: input.paymentMethod,
    status: "PENDING",
    external_reference: input.externalReference ?? input.orderId,
  });
  if (error) throw new Error(`Falha no pagamento: ${error.message}`);
}
