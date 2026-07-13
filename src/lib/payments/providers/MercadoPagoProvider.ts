// Provider do Mercado Pago.
// Toda comunicação com o MP acontece dentro de Edge Functions.
// Este módulo apenas invoca `mp-oauth` via supabase.functions.invoke —
// nunca manipula access token, refresh token ou client secret.

import { supabase } from "@/integrations/supabase/client";
import type {
  ConnectionStatus,
  CreateCheckoutInput,
  CreateCheckoutResult,
  OAuthStartResult,
  PaymentProvider,
} from "./PaymentProvider";

async function callMpOauth<T = any>(action: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("mp-oauth", {
    body: { action, ...body },
  });
  if (error) throw error;
  return data as T;
}

export const MercadoPagoProvider: PaymentProvider = {
  id: "mercado_pago",
  label: "Mercado Pago",
  supportsOAuth: true,

  async startOAuth(restaurantId, redirectTo) {
    const data = await callMpOauth<{ authorize_url: string }>("start", {
      restaurant_id: restaurantId,
      redirect_to: redirectTo,
    });
    return { authorizeUrl: data.authorize_url } satisfies OAuthStartResult;
  },

  async getStatus(restaurantId) {
    const d = await callMpOauth<any>("status", { restaurant_id: restaurantId });
    return {
      provider: "mercado_pago",
      connected: !!d.connected,
      accountId: d.mp_user_id ?? null,
      liveMode: !!d.live_mode,
      scope: d.scope ?? null,
      connectedAt: d.connected_at ?? null,
      disconnectedAt: d.disconnected_at ?? null,
      expiresAt: d.expires_at ?? null,
      publicKey: d.public_key ?? null,
    } satisfies ConnectionStatus;
  },

  async disconnect(restaurantId) {
    await callMpOauth("disconnect", { restaurant_id: restaurantId });
  },

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    // MP roteia via PaymentIntentService (mp-payment-intent). Aqui apenas
    // delegamos, mantendo o Provider Pattern como única porta de entrada.
    const { data, error } = await supabase.functions.invoke("mp-payment-intent", {
      body: {
        action: "create",
        order_id: input.orderId,
        payment_method: input.method === "card" ? "credit_card" : "pix",
        payer_email: input.customerEmail,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error(String((data as any).error));
    return {
      provider: "mercado_pago",
      redirectUrl: (data?.payment_url as string) ?? null,
      externalId: (data?.payment_id as string) ?? null,
      pix: {
        qrCode: data?.qr_code ?? null,
        qrCodeBase64: data?.qr_code_base64 ?? null,
        expirationDate: data?.expiration_date ?? null,
      },
      status: data?.status === "PROCESSING" ? "PROCESSING" : "PENDING",
    };
  },
};
