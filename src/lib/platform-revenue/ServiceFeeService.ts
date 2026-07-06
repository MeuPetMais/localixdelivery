// ServiceFeeService — cálculo puro da taxa de serviço da plataforma.
import type {
  RevenuePolicy,
  ServiceFeeCalculationInput,
  ServiceFeeCalculationResult,
} from "./types";

function round2(n: number) { return Math.round(n * 100) / 100; }

export const ServiceFeeService = {
  compute(policy: RevenuePolicy, input: ServiceFeeCalculationInput): ServiceFeeCalculationResult {
    const base: ServiceFeeCalculationResult = {
      amount: 0,
      type: policy.service_fee_type,
      policyId: "platform_singleton",
      currency: policy.currency,
    };
    if (!policy.active || !policy.service_fee_enabled) return base;

    const subtotal = Math.max(0, Number(input.subtotal) || 0);

    let amount = 0;
    switch (policy.service_fee_type) {
      case "FIXED":
        amount = policy.service_fee_value;
        break;
      case "PERCENTAGE":
        amount = subtotal * (policy.service_fee_value / 100);
        break;
      case "TIERED": {
        const tiers = policy.tiers ?? [];
        const match = tiers.find((t) => t.upTo === null || subtotal <= t.upTo);
        amount = match?.value ?? policy.service_fee_value;
        break;
      }
    }
    return { ...base, amount: round2(Math.max(0, amount)) };
  },
};
