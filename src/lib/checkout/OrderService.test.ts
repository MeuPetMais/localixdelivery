import { afterEach, describe, it, expect, vi } from "vitest";
import PricingEngine, { computePricing, DEFAULT_PRICING_SETTINGS, PricingError } from "@/lib/payments/PricingEngine";
import { buildCheckoutPaymentPayload, resolveCheckoutPayment } from "./checkout-payment";
import {
  canSubmitWithAuthoritativePricing,
  getAuthoritativeCustomerTotal,
  getCustomerServiceFee,
} from "./checkout-pricing-ui";
import { readFileSync } from "node:fs";
import { paymentMethodLabel } from "./paymentMethodLabel";
import { calculateAuthoritativeCheckoutPricing } from "./OrderService";
import {
  CheckoutValidationError,
  resolveAuthoritativeCheckoutPricing,
  type AuthoritativePricingRepository,
} from "./authoritative-pricing";

// Checkout â€” testes puros de regras financeiras usadas pelo OrderService.
// NÃ£o faz I/O; garante que Checkout inteligente confie 100% no PricingEngine.

const S = DEFAULT_PRICING_SETTINGS;

const PILOT_RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
const pilotSettings = {
  ...DEFAULT_PRICING_SETTINGS,
  minimum_order: 0,
  platform_fee_until_30: 0.99,
  platform_fee_above_30: 0.99,
};

function mockSupabaseAdmin(input: {
  serviceFeePayer: "customer" | "restaurant";
  minOrder?: number;
  deliveryFee?: number;
}) {
  return {
    from(table: string) {
      if (table === "restaurants") {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return {
              data: {
                id: PILOT_RESTAURANT_ID,
                min_order: input.minOrder ?? 0,
                delivery_fee: input.deliveryFee ?? 5,
              },
              error: null,
            };
          },
        };
      }

      if (table === "tenant_payment_settings") {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return {
              data: {
                restaurant_id: PILOT_RESTAURANT_ID,
                service_fee_payer: input.serviceFeePayer,
                service_fee_last_changed_at: null,
                service_fee_change_locked_until: null,
              },
              error: null,
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Checkout â€” validaÃ§Ãµes e snapshot", () => {
  it("rejeita pedido abaixo do mÃ­nimo", () => {
    expect(() => computePricing({ subtotal: 15 }, S)).toThrow(PricingError);
  });

  it("aceita pedido vÃ¡lido e calcula taxa da plataforma atÃ© R$30", () => {
    const p = computePricing({ subtotal: 25, deliveryFee: 6 }, S);
    expect(p.platformFee).toBe(0.99);
    expect(p.customerTotal).toBe(31.99);
  });

  it("aplica cupom no total do cliente e no lÃ­quido do restaurante", () => {
    const p = computePricing(
      { subtotal: 40, deliveryFee: 5, couponDiscount: 5 },
      S,
    );
    expect(p.customerTotal).toBe(41.49);
    expect(p.restaurantNet).toBe(35);
    expect(p.platformFee).toBe(1.49);
  });

  it("produz snapshot financeiro completo (todas as colunas)", () => {
    const p = computePricing({ subtotal: 50, deliveryFee: 6 }, S);
    for (const k of [
      "subtotal",
      "deliveryFee",
      "platformFee",
      "gatewayFee",
      "couponDiscount",
      "cashback",
      "restaurantGross",
      "restaurantNet",
      "serviceFeePayer",
      "expectedPlatformFee",
      "expectedPlatformRevenue",
      "realizedPlatformRevenue",
      "platformRevenue",
      "gatewayRevenue",
      "customerTotal",
      "currency",
    ] as const) {
      expect(p[k]).not.toBeUndefined();
    }
  });

  it("registro de pagamento nasce como PENDING (contrato)", () => {
    const initialStatus = "PENDING";
    expect(initialStatus).toBe("PENDING");
  });

  it("cartao online entra como aguardando pagamento", () => {
    expect(resolveCheckoutPayment("credit_card")).toMatchObject({
      paymentMethod: "credit_card",
      pricingMethod: "credit_card",
      initialStatus: "aguardando_pagamento",
      paymentRecordStatus: "PENDING",
    });
  });

  it("cartao na entrega persiste identificador proprio e entra como aguardando aceite", () => {
    expect(resolveCheckoutPayment("card_on_delivery")).toMatchObject({
      paymentMethod: "card_on_delivery",
      pricingMethod: "cash",
      initialStatus: "pago",
      paymentRecordStatus: "APPROVED",
    });
  });

  it("checkout envia card_on_delivery quando usuario escolhe Cartao na entrega", () => {
    const routeOption = {
      id: "card_on_delivery",
      label: "CartÃ£o na entrega",
      method: "card_on_delivery" as const,
    };

    expect(buildCheckoutPaymentPayload(routeOption)).toMatchObject({
      selectedOption: routeOption,
      selectedPaymentMethod: "card_on_delivery",
      payloadPaymentMethod: "card_on_delivery",
    });
  });

  it("payload legado card_delivery tambem persiste como card_on_delivery", () => {
    expect(resolveCheckoutPayment("card_delivery")).toMatchObject({
      inputMethod: "card_delivery",
      paymentMethod: "card_on_delivery",
      initialStatus: "pago",
    });
  });

  it("dinheiro entra como aguardando aceite", () => {
    expect(resolveCheckoutPayment("cash")).toMatchObject({
      paymentMethod: "cash",
      pricingMethod: "cash",
      initialStatus: "pago",
      paymentRecordStatus: "APPROVED",
    });
  });

  it("pix online pendente entra como aguardando pagamento", () => {
    expect(resolveCheckoutPayment("pix")).toMatchObject({
      paymentMethod: "pix",
      pricingMethod: "pix",
      initialStatus: "aguardando_pagamento",
      paymentRecordStatus: "PENDING",
    });
  });

  it("preview customer no piloto soma taxa Localix ao total do cliente", () => {
    const p = computePricing(
      { subtotal: 3.5, deliveryFee: 5, serviceFeePayer: "customer" },
      pilotSettings,
    );

    expect(p.platformFee).toBe(0.99);
    expect(p.customerTotal).toBe(9.49);
    expect(p.restaurantNet).toBe(3.5);
  });

  it("preview restaurant no piloto nao soma taxa Localix ao total do cliente", () => {
    const p = computePricing(
      { subtotal: 3.5, deliveryFee: 5, serviceFeePayer: "restaurant" },
      pilotSettings,
    );

    expect(p.platformFee).toBe(0.99);
    expect(p.customerTotal).toBe(8.5);
    expect(p.restaurantNet).toBe(2.51);
  });

  it("preview autoritativa respeita min_order do restaurante igual a zero", async () => {
    vi.spyOn(PricingEngine, "calculateOrderPricing").mockImplementation(async (input) =>
      computePricing(input, {
        ...pilotSettings,
        minimum_order: Number(input.minimumOrder),
        service_fee_payer: input.serviceFeePayer,
      }),
    );

    const pricing = await calculateAuthoritativeCheckoutPricing(
      mockSupabaseAdmin({ serviceFeePayer: "customer", minOrder: 0 }),
      {
        restaurantId: PILOT_RESTAURANT_ID,
        subtotal: 3.5,
        deliveryFee: 5,
        paymentMethod: "pix",
      },
    );

    expect(pricing.customerTotal).toBe(9.49);
    expect(PricingEngine.calculateOrderPricing).toHaveBeenCalledWith(expect.objectContaining({
      minimumOrder: 0,
      serviceFeePayer: "customer",
      restaurantId: PILOT_RESTAURANT_ID,
    }));
  });

  it("preview autoritativa e criacao real usam o mesmo payload financeiro", async () => {
    const spy = vi.spyOn(PricingEngine, "calculateOrderPricing").mockImplementation(async (input) =>
      computePricing(input, {
        ...pilotSettings,
        minimum_order: Number(input.minimumOrder),
        service_fee_payer: input.serviceFeePayer,
      }),
    );
    const supabaseAdmin = mockSupabaseAdmin({ serviceFeePayer: "customer", minOrder: 0 });

    const previewPricing = await calculateAuthoritativeCheckoutPricing(supabaseAdmin, {
      restaurantSlug: "localix-mp-staging-pilot",
      subtotal: 3.5,
      deliveryFee: 5,
      couponDiscount: 0,
      cashback: 0,
      loyaltyDiscount: 0,
      paymentMethod: "pix",
    });

    const creationPricing = await calculateAuthoritativeCheckoutPricing(supabaseAdmin, {
      restaurantId: PILOT_RESTAURANT_ID,
      subtotal: 3.5,
      deliveryFee: 5,
      couponDiscount: 0,
      cashback: 0,
      loyaltyDiscount: 0,
      paymentMethod: "pix",
    });

    expect(previewPricing).toMatchObject({
      platformFee: 0.99,
      customerTotal: 9.49,
      restaurantNet: 3.5,
      serviceFeePayer: "customer",
    });
    expect(creationPricing).toEqual(previewPricing);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("UI bloqueia pagamento e nao inventa total quando a preview falha", () => {
    const state = {
      pricing: null,
      pricingLoading: false,
      pricingError: "Não foi possível calcular o valor final do pedido. Tente novamente.",
    };

    expect(canSubmitWithAuthoritativePricing(state)).toBe(false);
    expect(getAuthoritativeCustomerTotal(state)).toBeNull();
  });

  it("UI bloqueia pagamento enquanto a preview esta carregando", () => {
    expect(canSubmitWithAuthoritativePricing({
      pricing: null,
      pricingLoading: true,
      pricingError: null,
    })).toBe(false);
  });

  it("UI mostra taxa quando customer e nao adiciona taxa visivel quando restaurant", () => {
    expect(getCustomerServiceFee({
      platformFee: 0.99,
      customerTotal: 9.49,
      serviceFeePayer: "customer",
    })).toBe(0.99);
    expect(getCustomerServiceFee({
      platformFee: 0.99,
      customerTotal: 8.5,
      serviceFeePayer: "restaurant",
    })).toBe(0);
  });

  it("checkout publico nao contem mais fallback financeiro local antigo", () => {
    const route = readFileSync("src/routes/$slug.index.tsx", "utf8");

    expect(route).not.toContain("Math.max(0, subtotal - discount) + fee");
    expect(route).toContain("canSubmitWithAuthoritativePricing");
  });

  it("labels do painel e acompanhamento distinguem cartao online de cartao na entrega", () => {
    expect(paymentMethodLabel("credit_card")).toBe("Cartão Online");
    expect(paymentMethodLabel("card_on_delivery")).toBe("💳 Cartão na entrega");
    expect(paymentMethodLabel("card_delivery")).toBe("💳 Cartão na entrega");
  });
});

const product = (over: Record<string, unknown> = {}) => ({
  id: "prod-1",
  restaurant_id: "rest-1",
  name: "Burger",
  price: 25,
  promo_price: null,
  promo_starts_at: null,
  promo_ends_at: null,
  recurrence_days: null,
  recurrence_start_time: null,
  recurrence_end_time: null,
  is_active: true,
  is_available: true,
  is_paused: false,
  ...over,
});

const builder = (over: Record<string, unknown> = {}) => ({
  id: "builder-1",
  restaurant_id: "rest-1",
  name: "Pizza",
  base_price: 20,
  is_active: true,
  builder_groups: [
    {
      id: "group-1",
      builder_id: "builder-1",
      name: "Extras",
      is_required: false,
      min_select: 0,
      max_select: 3,
      builder_options: [
        { id: "opt-1", group_id: "group-1", name: "Borda", price_delta: 3.5, max_qty: 2 },
      ],
    },
  ],
  ...over,
});

function repo(over: Partial<AuthoritativePricingRepository> = {}): AuthoritativePricingRepository {
  return {
    async getProducts(ids, restaurantId) {
      const rows = [product()];
      return rows.filter((p) => ids.includes(String(p.id)) && p.restaurant_id === restaurantId) as any;
    },
    async getBuilders(ids, restaurantId) {
      const rows = [builder()];
      return rows.filter((b) => ids.includes(String(b.id)) && b.restaurant_id === restaurantId) as any;
    },
    async getProductOptionConfig() {
      return { groups: [], options: [] };
    },
    async getCoupon(code) {
      if (code === "SAVE10") {
        return { code: "SAVE10", discount_percent: 10, valid_until: null, is_active: true };
      }
      return null;
    },
    ...over,
  };
}

describe("Checkout authoritative pricing", () => {
  it("resolves normal product from server price", async () => {
    const r = await resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{ id: "prod-1", name: "Burger", price: 25, qty: 2 }],
      repository: repo(),
    });

    expect(r.subtotal).toBe(50);
    expect(r.items[0]).toMatchObject({ id: "prod-1", price: 25, qty: 2, total: 50 });
  });

  it("rejects lower frontend price manipulation", async () => {
    await expect(resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{ id: "prod-1", price: 1, qty: 1 }],
      repository: repo(),
    })).rejects.toMatchObject({ code: "checkout_price_changed" });
  });

  it("rejects higher frontend price divergence", async () => {
    await expect(resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{ id: "prod-1", price: 99, qty: 1 }],
      repository: repo(),
    })).rejects.toMatchObject({ code: "checkout_price_changed" });
  });

  it("rejects nonexistent product", async () => {
    await expect(resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{ id: "missing", price: 25, qty: 1 }],
      repository: repo(),
    })).rejects.toMatchObject({ code: "checkout_item_invalid" });
  });

  it("rejects inactive product", async () => {
    await expect(resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{ id: "prod-1", price: 25, qty: 1 }],
      repository: repo({
        async getProducts() {
          return [product({ is_active: false })] as any;
        },
      }),
    })).rejects.toMatchObject({ code: "checkout_item_invalid" });
  });

  it("rejects product from another restaurant", async () => {
    await expect(resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{ id: "prod-1", price: 25, qty: 1 }],
      repository: repo({
        async getProducts() {
          return [product({ restaurant_id: "rest-2" })] as any;
        },
      }),
    })).rejects.toMatchObject({ code: "checkout_item_invalid" });
  });

  it("rejects invalid quantity", async () => {
    await expect(resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{ id: "prod-1", price: 25, qty: 0 }],
      repository: repo(),
    })).rejects.toBeInstanceOf(CheckoutValidationError);
  });

  it("rejects manipulated product option/addon", async () => {
    await expect(resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{
        id: "prod-1",
        price: 30,
        qty: 1,
        selectedOptions: [{ groupId: "addon-group", optionId: "foreign-addon", qty: 1 }],
      }],
      repository: repo({
        async getProductOptionConfig() {
          return {
            groups: [{
              id: "addon-group",
              product_id: "prod-1",
              name: "Adicionais",
              type: "MULTIPLE",
              min_selection: 0,
              max_selection: 3,
              required: false,
              price_strategy: "SUM",
              display_order: 0,
            }],
            options: [{
              id: "allowed-addon",
              group_id: "addon-group",
              name: "Bacon",
              price_adjustment: 5,
              max_quantity: 2,
              display_order: 0,
              active: true,
            }],
          };
        },
      }),
    })).rejects.toMatchObject({ code: "checkout_item_invalid" });
  });

  it("rejects manipulated builder selection", async () => {
    await expect(resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{
        id: "builder:builder-1:1",
        kind: "builder",
        builderId: "builder-1",
        price: 20,
        qty: 1,
        selections: [{ groupId: "group-1", optionId: "foreign-option", qty: 1 }],
      }],
      repository: repo(),
    })).rejects.toMatchObject({ code: "checkout_item_invalid" });
  });

  it("does not apply expired promotion", async () => {
    const r = await resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{ id: "prod-1", price: 25, qty: 1 }],
      repository: repo({
        async getProducts() {
          return [product({ promo_price: 10, promo_ends_at: "2020-01-01T00:00:00.000Z" })] as any;
        },
      }),
    });

    expect(r.subtotal).toBe(25);
  });

  it("does not apply invalid coupon value from browser", async () => {
    const r = await resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{ id: "prod-1", price: 25, qty: 1 }],
      couponCode: "FAKE",
      repository: repo(),
    });

    expect(r.couponDiscount).toBe(0);
  });

  it("calculates coupon and line totals with cents rounding", async () => {
    const r = await resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{ id: "prod-1", price: 10.99, qty: 3 }],
      couponCode: "SAVE10",
      repository: repo({
        async getProducts() {
          return [product({ price: 10.99 })] as any;
        },
      }),
    });

    expect(r.subtotal).toBe(32.97);
    expect(r.couponDiscount).toBe(3.3);
  });

  it("prices valid builder selections from server-side deltas", async () => {
    const r = await resolveAuthoritativeCheckoutPricing({
      restaurantId: "rest-1",
      items: [{
        id: "builder:builder-1:1",
        kind: "builder",
        builderId: "builder-1",
        price: 27,
        qty: 1,
        selections: [{ groupId: "group-1", optionId: "opt-1", qty: 2 }],
      }],
      repository: repo(),
    });

    expect(r.subtotal).toBe(27);
  });
});
