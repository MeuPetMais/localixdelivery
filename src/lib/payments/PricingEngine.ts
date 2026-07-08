// PricingEngine — motor financeiro central da Localix.
//
// REGRA DE OURO: nenhum outro módulo (React, Checkout, Carrinho,
// PaymentService, Providers, Edge Functions) pode calcular taxas ou
// totais. Toda regra financeira passa OBRIGATORIAMENTE por aqui.
//
// Este módulo NÃO se comunica com gateways de pagamento — apenas
// calcula valores a partir de configuração persistida em banco e de
// calculadoras de taxa de gateway (estrutura pronta, sem chamadas reais).
//
// Documentação completa: ver `PricingEngine.README.md` neste diretório.

import { supabase } from "@/integrations/supabase/client";

// ------------------------------------------------------------
// Tipos públicos
// ------------------------------------------------------------

export type PaymentMethod = "pix" | "credit_card" | "debit_card" | "cash";
export type ProviderId = "mercado_pago" | "pagarme" | "asaas" | "stripe";

export interface PricingInput {
  subtotal: number;
  deliveryFee?: number;
  couponDiscount?: number;
  cashback?: number;
  loyaltyDiscount?: number;
  paymentMethod?: PaymentMethod;
  provider?: ProviderId;
  restaurantId?: string;
  /** Pedido mínimo do restaurante — se definido, sobrepõe o global da plataforma. */
  minimumOrder?: number | null;
}

export interface PricingResult {
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  gatewayFee: number;
  couponDiscount: number;
  cashback: number;
  loyaltyDiscount: number;
  customerTotal: number;
  restaurantGross: number;
  restaurantNet: number;
  platformRevenue: number;
  gatewayRevenue: number;
  estimatedProfit: number;
  currency: string;
}

export interface PricingSettings {
  minimum_order: number;
  platform_fee_until_30: number;
  platform_fee_above_30: number;
  default_gateway: ProviderId;
  gateway_enabled: Record<string, boolean>;
  currency: string;
}

export class PricingError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "PricingError";
    this.code = code;
    this.details = details;
  }
}

// ------------------------------------------------------------
// Defaults (usados apenas quando não há linha em platform_settings)
// ------------------------------------------------------------

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  minimum_order: 20,
  platform_fee_until_30: 0.99,
  platform_fee_above_30: 1.49,
  default_gateway: "mercado_pago",
  gateway_enabled: { mercado_pago: true },
  currency: "BRL",
};

// ------------------------------------------------------------
// Gateway fee calculators — estrutura pronta, sem chamadas reais
// ------------------------------------------------------------

export interface GatewayFeeInput {
  amount: number;
  method: PaymentMethod;
}

export interface GatewayFeeCalculator {
  readonly id: ProviderId;
  calculate(input: GatewayFeeInput): number;
}

export const MercadoPagoCalculator: GatewayFeeCalculator = {
  id: "mercado_pago",
  calculate(_input) {
    // Prompt futuro: taxas reais via API/config. Zero por enquanto para
    // manter compatibilidade com fluxo atual (sem checkout).
    return 0;
  },
};

export const PagarmeCalculator: GatewayFeeCalculator = {
  id: "pagarme",
  calculate: () => 0,
};

export const AsaasCalculator: GatewayFeeCalculator = {
  id: "asaas",
  calculate: () => 0,
};

export const StripeCalculator: GatewayFeeCalculator = {
  id: "stripe",
  calculate: () => 0,
};

const gatewayCalculators: Record<ProviderId, GatewayFeeCalculator> = {
  mercado_pago: MercadoPagoCalculator,
  pagarme: PagarmeCalculator,
  asaas: AsaasCalculator,
  stripe: StripeCalculator,
};

export function getGatewayCalculator(id: ProviderId): GatewayFeeCalculator {
  return gatewayCalculators[id] ?? MercadoPagoCalculator;
}

// ------------------------------------------------------------
// Settings loader
// ------------------------------------------------------------

let _cache: { at: number; value: PricingSettings } | null = null;
const CACHE_TTL_MS = 60_000;

export async function loadPricingSettings(force = false): Promise<PricingSettings> {
  if (!force && _cache && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.value;

  const { data, error } = await supabase
    .from("platform_settings" as any)
    .select(
      "minimum_order, platform_fee_until_30, platform_fee_above_30, default_gateway, gateway_enabled, currency",
    )
    .eq("id", true)
    .maybeSingle();

  if (error) {
    // Não derruba a aplicação — usa defaults.
    return DEFAULT_PRICING_SETTINGS;
  }

  const row = (data ?? {}) as Partial<PricingSettings>;
  const value: PricingSettings = {
    minimum_order: Number(row.minimum_order ?? DEFAULT_PRICING_SETTINGS.minimum_order),
    platform_fee_until_30: Number(
      row.platform_fee_until_30 ?? DEFAULT_PRICING_SETTINGS.platform_fee_until_30,
    ),
    platform_fee_above_30: Number(
      row.platform_fee_above_30 ?? DEFAULT_PRICING_SETTINGS.platform_fee_above_30,
    ),
    default_gateway: (row.default_gateway ?? DEFAULT_PRICING_SETTINGS.default_gateway) as ProviderId,
    gateway_enabled:
      (row.gateway_enabled as Record<string, boolean>) ?? DEFAULT_PRICING_SETTINGS.gateway_enabled,
    currency: row.currency ?? DEFAULT_PRICING_SETTINGS.currency,
  };
  _cache = { at: Date.now(), value };
  return value;
}

export function clearPricingSettingsCache() {
  _cache = null;
}

// ------------------------------------------------------------
// Cálculo puro (testável) — não toca em banco
// ------------------------------------------------------------

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function computePricing(input: PricingInput, settings: PricingSettings): PricingResult {
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const deliveryFee = Math.max(0, Number(input.deliveryFee) || 0);
  const couponDiscount = Math.max(0, Number(input.couponDiscount) || 0);
  const cashback = Math.max(0, Number(input.cashback) || 0);
  const loyaltyDiscount = Math.max(0, Number(input.loyaltyDiscount) || 0);

  if (subtotal < settings.minimum_order) {
    throw new PricingError(
      "ORDER_BELOW_MINIMUM",
      `Pedido mínimo é R$ ${settings.minimum_order.toFixed(2)}.`,
      { subtotal, minimum: settings.minimum_order },
    );
  }

  const platformFee =
    subtotal <= 30 ? settings.platform_fee_until_30 : settings.platform_fee_above_30;

  const providerId: ProviderId = input.provider ?? settings.default_gateway;
  const gatewayFee = getGatewayCalculator(providerId).calculate({
    amount: subtotal + deliveryFee,
    method: input.paymentMethod ?? "pix",
  });

  const totalDiscount = couponDiscount + cashback + loyaltyDiscount;
  const customerTotal = round2(Math.max(0, subtotal + deliveryFee - totalDiscount));
  const restaurantGross = round2(subtotal);
  const restaurantNet = round2(Math.max(0, subtotal - couponDiscount - loyaltyDiscount));
  const platformRevenue = round2(platformFee);
  const gatewayRevenue = round2(gatewayFee);
  const estimatedProfit = round2(platformRevenue - gatewayRevenue);

  return {
    subtotal: round2(subtotal),
    deliveryFee: round2(deliveryFee),
    platformFee: round2(platformFee),
    gatewayFee: round2(gatewayFee),
    couponDiscount: round2(couponDiscount),
    cashback: round2(cashback),
    loyaltyDiscount: round2(loyaltyDiscount),
    customerTotal,
    restaurantGross,
    restaurantNet,
    platformRevenue,
    gatewayRevenue,
    estimatedProfit,
    currency: settings.currency,
  };
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

export const PricingEngine = {
  /** Cálculo de pricing de um pedido. Única entrada oficial. */
  async calculateOrderPricing(input: PricingInput): Promise<PricingResult> {
    const settings = await loadPricingSettings();
    // Fonte única da taxa de serviço: PlatformRevenue Domain.
    const { PlatformRevenueService } = await import("@/lib/platform-revenue");
    const fee = await PlatformRevenueService.getCurrentServiceFee(Number(input.subtotal) || 0);
    // Pedido mínimo: prioriza restaurante, faz fallback para plataforma.
    const restaurantMin =
      input.minimumOrder != null && Number.isFinite(Number(input.minimumOrder))
        ? Number(input.minimumOrder)
        : null;
    const effectiveMinimum = restaurantMin ?? settings.minimum_order;
    const merged: PricingSettings = {
      ...settings,
      minimum_order: effectiveMinimum,
      platform_fee_until_30: fee,
      platform_fee_above_30: fee,
    };
    return computePricing(input, merged);
  },

  /** Verifica se um subtotal atinge o pedido mínimo (sem lançar). */
  async meetsMinimumOrder(subtotal: number, restaurantMinimum?: number | null): Promise<boolean> {
    const s = await loadPricingSettings();
    const min =
      restaurantMinimum != null && Number.isFinite(Number(restaurantMinimum))
        ? Number(restaurantMinimum)
        : s.minimum_order;
    return subtotal >= min;
  },

  loadSettings: loadPricingSettings,
  clearCache: clearPricingSettingsCache,
  compute: computePricing,
};

export default PricingEngine;
