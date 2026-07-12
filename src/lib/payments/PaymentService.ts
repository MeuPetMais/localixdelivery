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

  // ------- Gateway principal por restaurante -------
  async getPrimaryProvider(restaurantId: string): Promise<string> {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("restaurants")
      .select("payment_provider")
      .eq("id", restaurantId)
      .maybeSingle();
    return (data as any)?.payment_provider ?? DEFAULT_PROVIDER_ID;
  },
  async setPrimaryProvider(restaurantId: string, providerId: string): Promise<void> {
    if (!paymentProviders[providerId]) throw new Error(`Provider inválido: ${providerId}`);
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("restaurants")
      .update({ payment_provider: providerId } as any)
      .eq("id", restaurantId);
    if (error) throw new Error(error.message);
  },

  // ------- Criação de cobrança (única porta de entrada) -------
  async createPayment(input: CreatePaymentInput): Promise<CreateCheckoutResult> {
    if (!input.orderId) throw new Error("orderId obrigatório");
    if (!input.restaurantId) throw new Error("restaurantId obrigatório");
    if (!input.customerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.customerEmail)) {
      throw new Error("customerEmail obrigatório e válido");
    }
    if (!input.successUrl || !input.cancelUrl) {
      throw new Error("successUrl e cancelUrl obrigatórios");
    }
    if (!input.amount || input.amount <= 0) throw new Error("amount inválido");
    const method: "pix" | "card" = input.method === "pix" ? "pix" : "card";
    const providerId = input.providerId ?? (await this.getPrimaryProvider(input.restaurantId));
    const provider = this.provider(providerId);
    // Valida se o gateway principal está conectado antes de tentar cobrar.
    const status = await provider.getStatus(input.restaurantId).catch(() => null);
    if (!status?.connected) {
      throw new Error("Nenhum gateway de pagamento configurado.");
    }
    const checkoutInput: CreateCheckoutInput = {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      method,
      amount: input.amount,
      customerEmail: input.customerEmail,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    };
    return provider.createCheckout(checkoutInput);
  },


  async refreshStatus(_paymentId: string): Promise<never> {
    throw new Error("PaymentService.refreshStatus ainda não implementado.");
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
