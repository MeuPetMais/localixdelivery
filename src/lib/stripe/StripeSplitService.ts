// Stripe Domain — Split calculation.
// Único serviço que conhece regras de split. Nenhum outro módulo deve
// duplicar essa lógica.
//
// Regras:
//  - A taxa da plataforma vem EXCLUSIVAMENTE do PlatformRevenueService.
//    Nunca hardcode. Nunca 0.99 direto. Nunca lê `platform_settings` daqui.
//  - Todos os valores são em reais (BRL). A conversão para centavos ocorre
//    apenas quando o payload é enviado à Stripe (edge function).

import { PlatformRevenueService } from "@/lib/platform-revenue";

export interface SplitInput {
  /** Valor total do pedido (bruto), em BRL. */
  amount: number;
  /** ID da conta Stripe Connect Express do restaurante (acct_...). */
  restaurantStripeAccountId: string;
  /** IDs de rastreio — vão para metadata do PaymentIntent. */
  orderId: string;
  restaurantId: string;
}

export interface SplitCalculation {
  gross: number;
  /** Fee da plataforma (Localix). */
  platformFee: number;
  /** Quanto o restaurante recebe. */
  restaurantAmount: number;
  /** Conta de destino do transfer_data. */
  destination: string;
}

export interface StripeTransferPayload {
  amount: number; // centavos
  currency: "brl";
  application_fee_amount: number; // centavos
  transfer_data: { destination: string };
  metadata: Record<string, string>;
}

function toCents(v: number): number {
  return Math.round(Number(v) * 100);
}

export const StripeSplitService = {
  /**
   * Calcula o split de um pedido. A taxa da plataforma é obtida via
   * PlatformRevenueService (fonte única de verdade).
   */
  async calculateSplit(input: SplitInput): Promise<SplitCalculation> {
    if (!input.amount || input.amount <= 0) throw new Error("invalid_amount");
    if (!input.restaurantStripeAccountId) throw new Error("missing_destination");

    const platformFee = await PlatformRevenueService.getCurrentServiceFee(input.amount);
    const restaurantAmount = Math.max(0, +(input.amount - platformFee).toFixed(2));

    return {
      gross: +input.amount.toFixed(2),
      platformFee: +platformFee.toFixed(2),
      restaurantAmount,
      destination: input.restaurantStripeAccountId,
    };
  },

  /**
   * Traduz o cálculo em um payload pronto para Stripe PaymentIntent
   * (parâmetros application_fee_amount + transfer_data.destination).
   */
  buildTransferData(split: SplitCalculation, input: Omit<SplitInput, "amount">): StripeTransferPayload {
    return {
      amount: toCents(split.gross),
      currency: "brl",
      application_fee_amount: toCents(split.platformFee),
      transfer_data: { destination: split.destination },
      metadata: {
        order_id: input.orderId,
        restaurant_id: input.restaurantId,
        restaurant_stripe_account: split.destination,
        platform_fee_brl: split.platformFee.toFixed(2),
        restaurant_amount_brl: split.restaurantAmount.toFixed(2),
      },
    };
  },

  /**
   * Valida invariantes de segurança: soma bate com o bruto e taxa não
   * ultrapassa o total.
   */
  validateSplit(split: SplitCalculation): { valid: boolean; reason?: string } {
    if (split.platformFee < 0) return { valid: false, reason: "negative_fee" };
    if (split.platformFee > split.gross) return { valid: false, reason: "fee_exceeds_total" };
    const sum = +(split.platformFee + split.restaurantAmount).toFixed(2);
    if (Math.abs(sum - split.gross) > 0.01) return { valid: false, reason: "sum_mismatch" };
    if (!split.destination.startsWith("acct_")) return { valid: false, reason: "invalid_destination" };
    return { valid: true };
  },

  summarizeSplit(split: SplitCalculation) {
    return {
      grossBRL: split.gross,
      platformFeeBRL: split.platformFee,
      restaurantAmountBRL: split.restaurantAmount,
      destination: split.destination,
      breakdown: `R$${split.gross.toFixed(2)} = R$${split.platformFee.toFixed(2)} (Localix) + R$${split.restaurantAmount.toFixed(2)} (restaurante)`,
    };
  },
};

export default StripeSplitService;
