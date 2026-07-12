// PaymentService — orquestração isolada do módulo de pagamentos.
// Regras arquiteturais:
//  - Toda comunicação com gateways passa por Edge Functions.
//  - Componentes React nunca falam com o MP diretamente.
//  - Providers implementam `PaymentProvider`; trocar/adicionar gateway
//    é uma alteração local, sem tocar no restante do app.

import { paymentsRepo, platformFeesRepo } from "./repositories";
import { getProvider, paymentProviders, DEFAULT_PROVIDER_ID } from "./providers";
import type { CreateCheckoutInput, CreateCheckoutResult, PaymentProvider } from "./providers/PaymentProvider";
import type { PaymentMethod, PlatformFees } from "./types";

export interface CreatePaymentInput {
  providerId?: string;
  restaurantId: string;
  orderId: string;
  method: PaymentMethod | "pix" | "card";
  amount: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
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
  provider(id: string = DEFAULT_PROVIDER_ID): PaymentProvider {
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

  // ------- Confirmação idempotente vinda de webhook (Stripe/MP) -------
  // Não altera regras de negócio: apenas atualiza status/paid_at do payment
  // identificado por (provider, external_id). Ledger e transição do pedido
  // são responsabilidade da Edge Function do provedor (fonte da verdade
  // durante o webhook).
  async confirmPayment(input: {
    provider: string;
    externalId: string;
    status: "pending" | "in_process" | "approved" | "rejected" | "cancelled" | "refunded";
    paidAt?: string | null;
  }) {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: existing } = await supabase
      .from("payments" as any)
      .select("id, status")
      .eq("provider", input.provider)
      .eq("external_id", input.externalId)
      .maybeSingle();
    if (!existing) return { ok: false as const, reason: "not_found" as const };
    if ((existing as any).status === input.status) return { ok: true as const, changed: false };
    const patch: Record<string, unknown> = { status: input.status };
    if (input.status === "approved") patch.paid_at = input.paidAt ?? new Date().toISOString();
    const { error } = await supabase.from("payments" as any).update(patch).eq("id", (existing as any).id);
    if (error) return { ok: false as const, reason: error.message };
    return { ok: true as const, changed: true };
  },
};
