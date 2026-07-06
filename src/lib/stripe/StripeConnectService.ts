// Stripe Domain — Connect Express.
// Fachada única para tudo relacionado a Stripe Connect Express.
// Nenhum consumidor externo deve chamar Edge Functions Stripe diretamente:
// sempre passar por aqui (ou pela `StripeService.connect` que reexporta).
//
// Regras:
//  - Nunca importa Payment/Checkout/Order/Billing/Loyalty.
//  - Nunca toca no banco diretamente. Toda persistência ocorre nas Edge
//    Functions `stripe-connect-create` e `stripe-connect-refresh`.
//  - Nunca manipula chaves Stripe no browser.

import { supabase } from "@/integrations/supabase/client";

export type StripeConnectStatus =
  | "not_created"
  | "onboarding_pending"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

export interface StripeConnectAccountSnapshot {
  accountId: string | null;
  status: StripeConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingCompleted: boolean;
  lastSync: string | null;
  capabilities: {
    card: "active" | "pending" | "inactive";
    pix: "active" | "pending" | "inactive";
    transfers: "active" | "pending" | "inactive";
  };
}

export interface StripeAccountLink {
  url: string;
  expiresAt: string;
}

function returnUrls(path = "/pagamentos") {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    returnUrl: `${origin}${path}?stripe=success`,
    refreshUrl: `${origin}${path}?stripe=refresh`,
  };
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message ?? `edge_${fn}_failed`);
  const payload = data as any;
  if (payload?.error) throw new Error(payload.error);
  return payload as T;
}

export const StripeConnectService = {
  /**
   * Cria uma conta Express (se ainda não existir) e devolve um Account Link
   * de onboarding hospedado pela Stripe. Persistência ocorre na Edge Function.
   */
  async createExpressAccount(
    restaurantId: string,
    opts?: { returnPath?: string },
  ): Promise<{ accountId: string; onboardingUrl: string }> {
    const { returnUrl, refreshUrl } = returnUrls(opts?.returnPath ?? "/pagamentos");
    return invoke("stripe-connect-create", {
      restaurantId,
      returnUrl,
      refreshUrl,
    });
  },

  /**
   * Gera um novo Account Link para retomar o onboarding de uma conta já existente.
   */
  async createAccountLink(
    restaurantId: string,
    opts?: { returnPath?: string },
  ): Promise<StripeAccountLink> {
    const { returnUrl, refreshUrl } = returnUrls(opts?.returnPath ?? "/pagamentos");
    return invoke("stripe-connect-create", {
      restaurantId,
      returnUrl,
      refreshUrl,
      onlyLink: true,
    });
  },

  /**
   * Consulta a Stripe, atualiza colunas locais e retorna o snapshot atual.
   */
  async refreshAccount(restaurantId: string): Promise<StripeConnectAccountSnapshot> {
    return invoke("stripe-connect-refresh", { restaurantId });
  },

  /** Alias semântico. */
  async retrieveAccount(restaurantId: string): Promise<StripeConnectAccountSnapshot> {
    return StripeConnectService.refreshAccount(restaurantId);
  },

  /** Alias semântico — capabilities são sincronizadas junto no refresh. */
  async syncCapabilities(restaurantId: string): Promise<StripeConnectAccountSnapshot> {
    return StripeConnectService.refreshAccount(restaurantId);
  },

  /** Desconecta a conta localmente. Documentação Stripe é preservada. */
  async disconnectAccount(restaurantId: string): Promise<void> {
    await invoke("stripe-connect-refresh", { restaurantId, disconnect: true });
  },
};

export default StripeConnectService;
