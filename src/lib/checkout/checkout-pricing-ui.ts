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

type CheckoutPricingPreviewClientEnv = {
  LOCALIX_ENV?: unknown;
  MODE?: unknown;
  VITE_LOCALIX_ENV?: unknown;
};

export function isCheckoutPricingPreviewClientDiagnosticsEnabled(
  env: CheckoutPricingPreviewClientEnv,
): boolean {
  return env.VITE_LOCALIX_ENV === "staging" || env.LOCALIX_ENV === "staging" || env.MODE === "staging";
}

export function logCheckoutPricingPreviewClientError(
  env: CheckoutPricingPreviewClientEnv,
  code: string,
  message: string,
) {
  if (!isCheckoutPricingPreviewClientDiagnosticsEnabled(env)) return;
  console.warn("[checkout-pricing-preview][client]", code, message);
}

export function logCheckoutPricingPreviewClientException(
  env: CheckoutPricingPreviewClientEnv,
  error: unknown,
) {
  if (!isCheckoutPricingPreviewClientDiagnosticsEnabled(env)) return;
  console.warn("[checkout-pricing-preview][client-exception]", error);
}
