// StripeProvider — Provider Pattern do domínio de pagamentos.
// Toda comunicação com Stripe passa por Edge Functions
// (stripe-checkout, stripe-connect-*). Nenhum segredo no bundle.

import { supabase } from "@/integrations/supabase/client";
import type {
  ConnectionStatus,
  CreateCheckoutInput,
  CreateCheckoutResult,
  OAuthStartResult,
  PaymentProvider,
} from "./PaymentProvider";

async function invokeStripe<T = any>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as T;
}

export const StripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Stripe",
  supportsOAuth: true,

  async startOAuth(restaurantId, redirectTo) {
    // Stripe Connect Express — cria conta + link de onboarding.
    const data = await invokeStripe<{ url?: string; onboardingUrl?: string }>(
      "stripe-connect-create",
      { restaurantId, returnUrl: redirectTo ?? null },
    );
    const url = (data.onboardingUrl ?? data.url ?? "") as string;
    if (!url) throw new Error("stripe_onboarding_url_missing");
    return { authorizeUrl: url } satisfies OAuthStartResult;
  },

  async getStatus(restaurantId) {
    const d = await invokeStripe<any>("stripe-connect-refresh", { restaurantId });
    return {
      provider: "stripe",
      connected: !!d?.accountId && d?.status === "active",
      accountId: d?.accountId ?? null,
      liveMode: false,
      scope: null,
      connectedAt: d?.lastSync ?? null,
      disconnectedAt: null,
      expiresAt: null,
      publicKey: null,
    } satisfies ConnectionStatus;
  },

  async disconnect(_restaurantId) {
    // Desconexão real fica a cargo de outra edge function; noop para não
    // deletar dados sensíveis inadvertidamente.
    return;
  },

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const data = await invokeStripe<any>("stripe-checkout", {
      orderId: input.orderId,
      method: input.method,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      customerEmail: input.customerEmail,
    });
    return {
      provider: "stripe",
      redirectUrl: (data?.url as string) ?? null,
      externalId: (data?.sessionId as string) ?? null,
      status: "PENDING",
    };
  },
};

export default StripeProvider;
