// Stripe Domain — Account.
// Leitura de status e metadados da conta conectada.

import type { StripeAccount } from "./types";

export const StripeAccountService = {
  async getAccount(_restaurantId: string): Promise<StripeAccount | null> {
    // Placeholder — implementado no milestone de pagamentos.
    return null;
  },

  async refreshAccount(_restaurantId: string): Promise<StripeAccount | null> {
    return null;
  },

  async updateAccount(_restaurantId: string, _patch: Partial<StripeAccount>): Promise<void> {
    throw new Error("StripeAccountService.updateAccount não implementado.");
  },

  async hasPendingOnboarding(restaurantId: string): Promise<boolean> {
    const a = await StripeAccountService.getAccount(restaurantId);
    if (!a) return true;
    return (
      a.status === "onboarding_pending" ||
      a.status === "onboarding_incomplete" ||
      !a.detailsSubmitted
    );
  },
};

export default StripeAccountService;
