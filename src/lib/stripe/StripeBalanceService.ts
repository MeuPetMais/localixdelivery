// Stripe Domain — Balance.

import type { StripeBalance } from "./types";

export const StripeBalanceService = {
  async get(_restaurantId: string): Promise<StripeBalance | null> {
    return null;
  },
  format(b: StripeBalance | null): string {
    if (!b) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: (b.currency || "brl").toUpperCase(),
    }).format(b.available / 100);
  },
};

export default StripeBalanceService;
