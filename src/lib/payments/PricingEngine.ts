/* eslint-disable @typescript-eslint/no-explicit-any */
// PricingEngine â€” motor financeiro central da Localix.
//
// REGRA DE OURO: nenhum outro mÃ³dulo (React, Checkout, Carrinho,
// PaymentService, Providers, Edge Functions) pode calcular taxas ou
// totais. Toda regra financeira passa OBRIGATORIAMENTE por aqui.
//
// Este mÃ³dulo NÃƒO se comunica com gateways de pagamento â€” apenas
// calcula valores a partir de configuraÃ§Ã£o persistida em banco e de
// calculadoras de taxa de gateway (estrutura pronta, sem chamadas reais).
//
// DocumentaÃ§Ã£o completa: ver `PricingEngine.README.md` neste diretÃ³rio.

import { supabase } from "@/integrations/supabase/client";

// ------------------------------------------------------------
// Tipos pÃºblicos
// ------------------------------------------------------------

export type PaymentMethod = "pix" | "credit_card" | "debit_card" | "cash";
export type ProviderId = "mercado_pago" | "pagarme" | "asaas" | "stripe";
export type ServiceFeePayer = "customer" | "restaurant";

export interface PricingInput {
  subtotal: number;
  deliveryFee?: number;
  couponDiscount?: number;
  cashback?: number;
  loyaltyDiscount?: number;
  paymentMethod?: PaymentMethod;
  provider?: ProviderId;
  restaurantId?: string;
  serviceFeePayer?: ServiceFeePayer;
  /** Pedido mÃ­nimo do restaurante â€” se definido, sobrepÃµe o global da plataforma. */
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
  serviceFeePayer: ServiceFeePayer;
  expectedPlatformFee: number;
  expectedPlatformRevenue: number;
  realizedPlatformRevenue: number;
  /** Alias compatível com o snapshot: receita esperada, não realizada. */
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
  service_fee_payer?: ServiceFeePayer;
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
// Defaults (usados apenas quando nÃ£o hÃ¡ linha em platform_settings)
// ------------------------------------------------------------

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  minimum_order: 20,
  platform_fee_until_30: 0.99,
  platform_fee_above_30: 1.49,
  default_gateway: "mercado_pago",
  gateway_enabled: { mercado_pago: true },
  currency: "BRL",
  service_fee_payer: "customer",
};

// ------------------------------------------------------------
// Gateway fee calculators â€” estrutura pronta, sem chamadas reais
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
    // NÃ£o derruba a aplicaÃ§Ã£o â€” usa defaults.
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
    default_gateway: (row.default_gateway ??
      DEFAULT_PRICING_SETTINGS.default_gateway) as ProviderId,
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
// CÃ¡lculo puro (testÃ¡vel) â€” nÃ£o toca em banco
// ------------------------------------------------------------

function toCents(n: number | null | undefined) {
  const value = Number(n);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 100));
}

function fromCents(cents: number) {
  return cents / 100;
}

function normalizeServiceFeePayer(value: unknown): ServiceFeePayer {
  return value === "restaurant" ? "restaurant" : "customer";
}

export function computePricing(input: PricingInput, settings: PricingSettings): PricingResult {
  const subtotalCents = toCents(input.subtotal);
  const deliveryFeeCents = toCents(input.deliveryFee);
  const couponDiscountCents = toCents(input.couponDiscount);
  const cashbackCents = toCents(input.cashback);
  const loyaltyDiscountCents = toCents(input.loyaltyDiscount);
  const subtotal = fromCents(subtotalCents);

  if (subtotal < settings.minimum_order) {
    throw new PricingError(
      "ORDER_BELOW_MINIMUM",
      `Pedido mínimo é R$ ${settings.minimum_order.toFixed(2)}.`,
      { subtotal, minimum: settings.minimum_order },
    );
  }

  const platformFeeCents = toCents(
    subtotal <= 30 ? settings.platform_fee_until_30 : settings.platform_fee_above_30,
  );
  const serviceFeePayer = normalizeServiceFeePayer(
    input.serviceFeePayer ?? settings.service_fee_payer,
  );

  const providerId: ProviderId = input.provider ?? settings.default_gateway;
  const gatewayFeeCents = toCents(
    getGatewayCalculator(providerId).calculate({
      amount: fromCents(subtotalCents + deliveryFeeCents),
      method: input.paymentMethod ?? "pix",
    }),
  );

  const totalDiscountCents = couponDiscountCents + cashbackCents + loyaltyDiscountCents;
  const itemsAndDeliveryTotalCents = Math.max(
    0,
    subtotalCents + deliveryFeeCents - totalDiscountCents,
  );
  const customerTotalCents =
    serviceFeePayer === "customer"
      ? itemsAndDeliveryTotalCents + platformFeeCents
      : itemsAndDeliveryTotalCents;
  const restaurantGrossCents = subtotalCents;
  const restaurantNetBeforeServiceFeeCents = Math.max(
    0,
    subtotalCents - couponDiscountCents - loyaltyDiscountCents,
  );
  const restaurantNetCents =
    serviceFeePayer === "restaurant"
      ? Math.max(0, restaurantNetBeforeServiceFeeCents - platformFeeCents)
      : restaurantNetBeforeServiceFeeCents;
  const expectedPlatformFeeCents = platformFeeCents;
  const expectedPlatformRevenueCents = platformFeeCents;
  const realizedPlatformRevenueCents = 0;
  const gatewayRevenueCents = gatewayFeeCents;
  const estimatedProfitCents = expectedPlatformRevenueCents - gatewayRevenueCents;

  return {
    subtotal: fromCents(subtotalCents),
    deliveryFee: fromCents(deliveryFeeCents),
    platformFee: fromCents(platformFeeCents),
    gatewayFee: fromCents(gatewayFeeCents),
    couponDiscount: fromCents(couponDiscountCents),
    cashback: fromCents(cashbackCents),
    loyaltyDiscount: fromCents(loyaltyDiscountCents),
    customerTotal: fromCents(customerTotalCents),
    restaurantGross: fromCents(restaurantGrossCents),
    restaurantNet: fromCents(restaurantNetCents),
    serviceFeePayer,
    expectedPlatformFee: fromCents(expectedPlatformFeeCents),
    expectedPlatformRevenue: fromCents(expectedPlatformRevenueCents),
    realizedPlatformRevenue: fromCents(realizedPlatformRevenueCents),
    platformRevenue: fromCents(expectedPlatformRevenueCents),
    gatewayRevenue: fromCents(gatewayRevenueCents),
    estimatedProfit: fromCents(estimatedProfitCents),
    currency: settings.currency,
  };
}

// ------------------------------------------------------------
// API pÃºblica
// ------------------------------------------------------------

export const PricingEngine = {
  /** CÃ¡lculo de pricing de um pedido. Ãšnica entrada oficial. */
  async calculateOrderPricing(input: PricingInput): Promise<PricingResult> {
    const settings = await loadPricingSettings();
    // Fonte Ãºnica da taxa de serviÃ§o: PlatformRevenue Domain.
    const { PlatformRevenueService } = await import("@/lib/platform-revenue");
    const fee = await PlatformRevenueService.getCurrentServiceFee(Number(input.subtotal) || 0);
    // Pedido mÃ­nimo: prioriza restaurante, faz fallback para plataforma.
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

  /** Verifica se um subtotal atinge o pedido mÃ­nimo (sem lanÃ§ar). */
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
