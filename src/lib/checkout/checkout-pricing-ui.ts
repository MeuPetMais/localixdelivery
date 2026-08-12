export type CheckoutPricingForUi = {
  platformFee: number;
  customerTotal: number;
  serviceFeePayer: "customer" | "restaurant";
};

export type CheckoutPricingUiState = {
  pricing: CheckoutPricingForUi | null;
  pricingLoading: boolean;
  pricingError: string | null;
};

export function getCustomerServiceFee(pricing: CheckoutPricingForUi | null): number {
  return pricing?.serviceFeePayer === "customer" ? pricing.platformFee : 0;
}

export function canSubmitWithAuthoritativePricing(state: CheckoutPricingUiState): boolean {
  return !!state.pricing && !state.pricingLoading && !state.pricingError;
}

export function getAuthoritativeCustomerTotal(state: CheckoutPricingUiState): number | null {
  if (!canSubmitWithAuthoritativePricing(state)) return null;
  return state.pricing!.customerTotal;
}
