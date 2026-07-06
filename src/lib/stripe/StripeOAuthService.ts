// Stripe Domain — OAuth / Account Links.
// Toda comunicação real com Stripe acontece dentro de Edge Functions
// (a serem criadas em milestone futuro). Este serviço apenas define o
// contrato e roteia via invocação segura, sem manipular chaves.

import type { StripeOnboardingLink } from "./types";

export const StripeOAuthService = {
  /**
   * Inicia o onboarding via Stripe Account Link.
   * Placeholder — a Edge Function `stripe-oauth` será implementada no
   * milestone de pagamentos. Nenhum consumidor externo deve chamar
   * diretamente: usar `StripeService.startOnboarding()`.
   */
  async createAccountLink(_restaurantId: string, _returnUrl?: string): Promise<StripeOnboardingLink> {
    throw new Error("StripeOAuthService.createAccountLink não implementado (milestone futuro).");
  },

  async connectExistingAccount(_restaurantId: string, _stripeAccountId: string): Promise<void> {
    throw new Error("StripeOAuthService.connectExistingAccount não implementado (milestone futuro).");
  },

  async disconnect(_restaurantId: string): Promise<void> {
    throw new Error("StripeOAuthService.disconnect não implementado (milestone futuro).");
  },
};

export default StripeOAuthService;
