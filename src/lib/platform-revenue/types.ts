// PlatformRevenue Domain — tipos públicos.
export type ServiceFeeType = "FIXED" | "PERCENTAGE" | "TIERED";

export interface RevenuePolicy {
  service_fee_enabled: boolean;
  service_fee_type: ServiceFeeType;
  /** Valor base. Em TIERED, use `tiers`. */
  service_fee_value: number;
  /** Faixas opcionais (ex.: até R$30 = 0.99; acima = 1.49). */
  tiers?: Array<{ upTo: number | null; value: number }>;
  currency: string;
  effective_from: string | null; // ISO
  effective_until: string | null; // ISO
  active: boolean;
}

export interface ServiceFeeCalculationInput {
  subtotal: number;
  deliveryFee?: number;
}

export interface ServiceFeeCalculationResult {
  amount: number;
  type: ServiceFeeType;
  policyId: string;
  currency: string;
}
