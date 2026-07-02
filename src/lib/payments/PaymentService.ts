// PaymentService — estrutura vazia (Prompt 1).
// A integração com o Mercado Pago será feita nos próximos prompts.
// Aqui apenas expõe a superfície de API que os próximos prompts vão implementar.

import { paymentsRepo, platformFeesRepo } from "./repositories";
import type { PaymentMethod, PlatformFees } from "./types";

export interface CreatePaymentInput {
  restaurantId: string;
  orderId?: string;
  method: PaymentMethod;
  amount: number;
  payerEmail?: string;
}

export interface FeeBreakdown {
  subtotal: number;
  platformFee: number;
  total: number;
  minOrder: number;
  meetsMinOrder: boolean;
}

export const PaymentService = {
  /** Calcula a taxa aplicável a partir da configuração global. */
  async calcFees(subtotal: number): Promise<FeeBreakdown> {
    const cfg = (await platformFeesRepo.get()) ?? ({
      min_order: 20,
      fee_up_to_30: 0.99,
      fee_above_30: 1.49,
      monthly_fee: 0,
    } as PlatformFees);
    const platformFee = subtotal <= 30 ? Number(cfg.fee_up_to_30) : Number(cfg.fee_above_30);
    return {
      subtotal,
      platformFee,
      total: Number((subtotal + platformFee).toFixed(2)),
      minOrder: Number(cfg.min_order),
      meetsMinOrder: subtotal >= Number(cfg.min_order),
    };
  },

  /** Placeholder — implementado no Prompt 5. */
  async createPayment(_input: CreatePaymentInput): Promise<never> {
    throw new Error("PaymentService.createPayment ainda não implementado (Prompt 5).");
  },

  /** Placeholder — implementado no Prompt 5. */
  async refreshStatus(_paymentId: string): Promise<never> {
    throw new Error("PaymentService.refreshStatus ainda não implementado (Prompt 5).");
  },

  /** Utilitário para consultar pagamentos já existentes. */
  async listByRestaurant(restaurantId: string, limit = 100) {
    return paymentsRepo.listByRestaurant(restaurantId, limit);
  },
};
