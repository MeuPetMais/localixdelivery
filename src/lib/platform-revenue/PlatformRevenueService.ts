// PlatformRevenueService — fachada pública do Platform Revenue Domain.
//
// REGRA DE OURO: nenhum outro módulo pode calcular ou hardcodar a taxa
// de serviço da plataforma. Toda leitura passa por aqui.

import { RevenueSettingsService } from "./RevenueSettingsService";
import { RevenuePolicyService } from "./RevenuePolicyService";
import { ServiceFeeService } from "./ServiceFeeService";
import { RevenueEvents } from "./RevenueEvents";
import type {
  RevenuePolicy,
  ServiceFeeCalculationInput,
  ServiceFeeCalculationResult,
} from "./types";

export const PlatformRevenueService = {
  async getPolicy(): Promise<RevenuePolicy> {
    return RevenueSettingsService.load();
  },

  async isActive(): Promise<boolean> {
    const p = await RevenueSettingsService.load();
    return RevenuePolicyService.isActive(p);
  },

  /** Taxa vigente para um subtotal específico. Fonte única de verdade. */
  async getCurrentServiceFee(subtotal: number): Promise<number> {
    const p = await RevenueSettingsService.load();
    if (!RevenuePolicyService.isActive(p)) {
      RevenueEvents.emit({ type: "ServiceFeeDisabled", at: new Date().toISOString() });
      return 0;
    }
    const r = ServiceFeeService.compute(p, { subtotal });
    RevenueEvents.emit({ type: "ServiceFeeCalculated", result: r, at: new Date().toISOString() });
    return r.amount;
  },

  async calculate(input: ServiceFeeCalculationInput): Promise<ServiceFeeCalculationResult> {
    const p = await RevenueSettingsService.load();
    if (!RevenuePolicyService.isActive(p)) {
      const zero: ServiceFeeCalculationResult = {
        amount: 0, type: p.service_fee_type, policyId: "platform_singleton", currency: p.currency,
      };
      return zero;
    }
    const r = ServiceFeeService.compute(p, input);
    RevenueEvents.emit({ type: "ServiceFeeCalculated", result: r, at: new Date().toISOString() });
    return r;
  },

  clearCache: RevenueSettingsService.clearCache,
};

export default PlatformRevenueService;
