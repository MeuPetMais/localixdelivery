// PaymentIntentService — orquestração de Payment Intent do Mercado Pago.
//
// REGRAS:
// - Toda comunicação com o MP passa por Edge Function (mp-payment-intent).
// - Frontend NUNCA chama a API do MP nem manipula access token.
// - Não altera OAuth, PricingEngine, Ledger, Checkout ou Providers.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PaymentIntentStatus =
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED";

export interface PaymentIntentResult {
  payment_id: string | null;
  status: PaymentIntentStatus;
  qr_code?: string | null;
  qr_code_base64?: string | null;
  payment_url?: string | null;
  expiration_date?: string | null;
  pending?: boolean;
  message?: string;
}

// Núcleo puro para testes.
export function mapMpStatus(s: string | null | undefined): PaymentIntentStatus {
  switch ((s ?? "").toLowerCase()) {
    case "approved":
    case "refunded":
    case "charged_back":
      return "APPROVED";
    case "in_process": return "PROCESSING";
    case "rejected": return "REJECTED";
    case "cancelled": return "CANCELLED";
    default: return "PENDING";
  }
}

export type InvokeFn = (body: Record<string, unknown>) => Promise<any>;

// Orquestração pura: pode ser testada sem o runtime do TanStack Start.
export async function runIntent(
  invoke: InvokeFn,
  action: "create" | "status" | "cancel",
  body: Record<string, unknown>,
): Promise<PaymentIntentResult> {
  const r = await invoke({ action, ...body });
  if (r?.error) throw new Error(String(r.error));
  const status: PaymentIntentStatus =
    (r?.status as PaymentIntentStatus) ?? (action === "cancel" ? "CANCELLED" : "PENDING");
  return {
    payment_id: r?.payment_id ?? null,
    status,
    qr_code: r?.qr_code ?? null,
    qr_code_base64: r?.qr_code_base64 ?? null,
    payment_url: r?.payment_url ?? null,
    expiration_date: r?.expiration_date ?? null,
    pending: !!r?.pending,
    message: r?.message,
  };
}

const createSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.enum(["pix", "credit_card", "debit_card"]).default("pix"),
  payerEmail: z.string().email().optional(),
});
const orderOnlySchema = z.object({ orderId: z.string().uuid() });

export const createPaymentIntent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.functions.invoke("mp-payment-intent", { body: {
      action: "create",
      order_id: data.orderId,
      payment_method: data.paymentMethod,
      payer_email: data.payerEmail,
    } });
    if (error) throw new Error(error.message);
    if (r?.error) throw new Error(String(r.error));
    const status: PaymentIntentStatus = (r?.status as PaymentIntentStatus) ?? "PENDING";
    return {
      payment_id: r?.payment_id ?? null,
      status,
      qr_code: r?.qr_code ?? null,
      qr_code_base64: r?.qr_code_base64 ?? null,
      payment_url: r?.payment_url ?? null,
      expiration_date: r?.expiration_date ?? null,
      pending: !!r?.pending,
      message: r?.message,
    };
  });

export const getPaymentIntentStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderOnlySchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.functions.invoke("mp-payment-intent", { body: {
      action: "status",
      order_id: data.orderId,
    } });
    if (error) throw new Error(error.message);
    if (r?.error) throw new Error(String(r.error));
    const status: PaymentIntentStatus = (r?.status as PaymentIntentStatus) ?? "PENDING";
    return {
      payment_id: r?.payment_id ?? null,
      status,
      qr_code: r?.qr_code ?? null,
      qr_code_base64: r?.qr_code_base64 ?? null,
      payment_url: r?.payment_url ?? null,
      expiration_date: r?.expiration_date ?? null,
      pending: !!r?.pending,
      message: r?.message,
    };
  });

export const cancelPaymentIntent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderOnlySchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.functions.invoke("mp-payment-intent", { body: {
      action: "cancel",
      order_id: data.orderId,
    } });
    if (error) throw new Error(error.message);
    if (r?.error) throw new Error(String(r.error));
    const status: PaymentIntentStatus = (r?.status as PaymentIntentStatus) ?? "CANCELLED";
    return {
      payment_id: r?.payment_id ?? null,
      status,
      qr_code: r?.qr_code ?? null,
      qr_code_base64: r?.qr_code_base64 ?? null,
      payment_url: r?.payment_url ?? null,
      expiration_date: r?.expiration_date ?? null,
      pending: !!r?.pending,
      message: r?.message,
    };
  });

export default {
  create: createPaymentIntent,
  status: getPaymentIntentStatus,
  cancel: cancelPaymentIntent,
  mapMpStatus,
  runIntent,
};
