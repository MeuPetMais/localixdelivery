// Stripe Domain — Capabilities.

import type { StripeCapabilities } from "./types";

export const StripeCapabilitiesService = {
  async get(_restaurantId: string): Promise<StripeCapabilities | null> {
    return null;
  },
  async requestCapability(_restaurantId: string, _capability: keyof StripeCapabilities): Promise<void> {
    throw new Error("StripeCapabilitiesService.requestCapability não implementado.");
  },
  isReadyForCharges(cap: StripeCapabilities | null): boolean {
    return !!cap && cap.cardPayments === "active" && cap.transfers === "active";
  },
};

export default StripeCapabilitiesService;
