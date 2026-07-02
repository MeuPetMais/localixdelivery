// PaymentService — orquestração isolada do módulo de pagamentos.
// Regras arquiteturais:
//  - Toda comunicação com gateways passa por Edge Functions.
//  - Componentes React nunca falam com o MP diretamente.
//  - Providers implementam `PaymentProvider`; trocar/adicionar gateway
//    é uma alteração local, sem tocar no restante do app.

import { paymentsRepo, platformFeesRepo } from "./repositories";
import { getProvider, paymentProviders } from "./providers";
import type { PaymentProvider } from "./providers";
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
  // ------- Providers -------
  provider(id: string = "mercado_pago"): PaymentProvider {
    return getProvider(id);
  },
  listProviders(): PaymentProvider[] {
    return Object.values(paymentProviders);
  },

  // ------- OAuth (via provider ativo) -------
  async connect(providerId: string, restaurantId: string, redirectTo?: string) {
    return this.provider(providerId).startOAuth(restaurantId, redirectTo);
  },
  async connectionStatus(providerId: string, restaurantId: string) {
    return this.provider(providerId).getStatus(restaurantId);
  },
  async disconnect(providerId: string, restaurantId: string) {
    return this.provider(providerId).disconnect(restaurantId);
  },

  // ------- Taxas da plataforma -------
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

  // ------- Placeholders — Prompt 5+ -------
  async createPayment(_input: CreatePaymentInput): Promise<never> {
    throw new Error("PaymentService.createPayment ainda não implementado (Prompt 5).");
  },
  async refreshStatus(_paymentId: string): Promise<never> {
    throw new Error("PaymentService.refreshStatus ainda não implementado (Prompt 5).");
  },

  async listByRestaurant(restaurantId: string, limit = 100) {
    return paymentsRepo.listByRestaurant(restaurantId, limit);
  },
};
