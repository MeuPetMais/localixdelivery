// OrderService — cria pedido + snapshot financeiro + registro de pagamento.
//
// REGRAS:
// - Todos os cálculos vêm do PricingEngine. Nunca calcular no frontend.
// - Não integra Mercado Pago, não cria Payment Intent, não faz Split.
// - Registro de pagamento online começa em PENDING; pagamento na entrega nasce APPROVED.
// - Snapshot financeiro é imutável (uma linha por pedido).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import PricingEngine, { PricingError, type ProviderId } from "@/lib/payments/PricingEngine";
import { optionalSupabaseAuth } from "@/integrations/supabase/optional-auth-middleware";
import { getRestaurantStatus } from "@/lib/restaurant-status";
import { getRestaurantClosedMessage } from "@/lib/restaurant-status-labels";
import { CHECKOUT_METHODS, resolveCheckoutPayment } from "./checkout-payment";
import {
  CheckoutValidationError,
  resolveAuthoritativeCheckoutPricing,
  type AuthoritativePricingRepository,
} from "./authoritative-pricing";
import { loadServiceFeeSettingsByRestaurant } from "@/lib/payments/service-fee-settings";

export type { CheckoutMethod } from "./checkout-payment";

const itemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  price: z.number().nonnegative().optional(),
  qty: z.number().int().positive(),
  kind: z.enum(["product", "builder"]).optional(),
  builderId: z.string().optional().nullable(),
  builder_id: z.string().optional().nullable(),
  selections: z
    .array(
      z.object({
        groupId: z.string().optional(),
        group_id: z.string().optional(),
        optionId: z.string().optional(),
        option_id: z.string().optional(),
        qty: z.number().int().positive().optional(),
        quantity: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  selectedOptions: z
    .array(
      z.object({
        groupId: z.string().optional(),
        group_id: z.string().optional(),
        optionId: z.string().optional(),
        option_id: z.string().optional(),
        qty: z.number().int().positive().optional(),
        quantity: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

const inputSchema = z.object({
  restaurantSlug: z.string().min(1),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(6),
    address: z.string().min(3),
    notes: z.string().optional(),
  }),
  items: z.array(itemSchema).min(1, "Carrinho vazio"),
  paymentMethod: z.enum(CHECKOUT_METHODS),
  deliveryFee: z.number().nonnegative().optional().default(0),
  couponCode: z.string().optional(),
  couponDiscount: z.number().nonnegative().optional().default(0),
  cashback: z.number().nonnegative().optional().default(0),
  loyaltyDiscount: z.number().nonnegative().optional().default(0),
  loyaltyPoints: z.number().int().nonnegative().optional().default(0),
});

export type CheckoutInput = z.infer<typeof inputSchema>;

export const createCheckoutOrder = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Validar restaurante ativo + conectado
    const { data: rest, error: restErr } = await supabaseAdmin
      .from("restaurants")
      .select("id, slug, active, is_open, opening_hours, owner_id, min_order, delivery_fee")
      .eq("slug", data.restaurantSlug)
      .maybeSingle();
    if (restErr) throw new Error(restErr.message);
    if (!rest) throw new Error("Restaurante não encontrado");
    if (!rest.active) throw new Error("Restaurante inativo");
    const restaurantStatus = getRestaurantStatus({
      is_open: rest.is_open,
      opening_hours: rest.opening_hours as any,
    });
    if (!restaurantStatus.isOpen) {
      throw new Error(getRestaurantClosedMessage(restaurantStatus.reason));
    }

    const paymentDecision = resolveCheckoutPayment(data.paymentMethod);
    console.log("[order-payment-debug]", {
      receivedPaymentMethod: data.paymentMethod,
      paymentDecision,
    });

    const repository: AuthoritativePricingRepository = {
      async getProducts(ids, restaurantId) {
        const { data: rows, error } = await supabaseAdmin
          .from("menu_items")
          .select("id, restaurant_id, name, price, promo_price, promo_starts_at, promo_ends_at, recurrence_days, recurrence_start_time, recurrence_end_time, is_active, is_available, is_paused")
          .eq("restaurant_id", restaurantId)
          .in("id", ids);
        if (error) throw new Error(error.message);
        return (rows ?? []) as any;
      },
      async getBuilders(ids, restaurantId) {
        const { data: rows, error } = await supabaseAdmin
          .from("builders")
          .select("id, restaurant_id, name, base_price, is_active, builder_groups(id, builder_id, name, is_required, min_select, max_select, builder_options(id, group_id, name, price_delta, max_qty))")
          .eq("restaurant_id", restaurantId)
          .in("id", ids);
        if (error) throw new Error(error.message);
        return (rows ?? []) as any;
      },
      async getProductOptionConfig(productIds, restaurantId) {
        const { data: groups, error: groupError } = await supabaseAdmin
          .from("product_option_groups")
          .select("id, product_id, name, description, type, min_selection, max_selection, required, price_strategy, display_order, depends_on_group_id, depends_on_option_id, metadata")
          .in("product_id", productIds);
        if (groupError) throw new Error(groupError.message);

        const safeGroups = ((groups ?? []) as any[]).filter((g) => productIds.includes(g.product_id));
        const groupIds = safeGroups.map((g) => g.id);
        if (groupIds.length === 0) return { groups: [], options: [] };

        const { data: products, error: productError } = await supabaseAdmin
          .from("menu_items")
          .select("id, restaurant_id")
          .eq("restaurant_id", restaurantId)
          .in("id", productIds);
        if (productError) throw new Error(productError.message);
        const allowedProductIds = new Set(((products ?? []) as any[]).map((p) => p.id));
        const ownedGroups = safeGroups.filter((g) => allowedProductIds.has(g.product_id));
        if (ownedGroups.length === 0) return { groups: [], options: [] };

        const { data: options, error: optionError } = await supabaseAdmin
          .from("product_options")
          .select("id, group_id, name, description, price_adjustment, max_quantity, image_url, inventory_reference, recipe_reference, display_order, active, metadata")
          .in("group_id", ownedGroups.map((g) => g.id));
        if (optionError) throw new Error(optionError.message);
        return { groups: ownedGroups as any, options: (options ?? []) as any };
      },
      async getCoupon(code, restaurantId) {
        const { data: coupon, error } = await supabaseAdmin
          .from("coupons")
          .select("code, discount_percent, valid_until, is_active")
          .eq("restaurant_id", restaurantId)
          .ilike("code", code.trim())
          .maybeSingle();
        if (error) throw new Error(error.message);
        return coupon as any;
      },
    };

    // 2) Subtotal e descontos resolvidos no servidor a partir de IDs/escolhas.
    let authoritative;
    try {
      authoritative = await resolveAuthoritativeCheckoutPricing({
        restaurantId: rest.id,
        items: data.items,
        couponCode: data.couponCode,
        repository,
      });
    } catch (e) {
      if (e instanceof CheckoutValidationError) {
        throw new Error(e.code);
      }
      throw e;
    }

    const deliveryFee = Number((rest as { delivery_fee?: number | null }).delivery_fee ?? 0) || 0;
    const serviceFeeSettings = await loadServiceFeeSettingsByRestaurant(supabaseAdmin, rest.id);

    // 3) Pricing — motor central
    let pricing;
    try {
      pricing = await PricingEngine.calculateOrderPricing({
        subtotal: authoritative.subtotal,
        deliveryFee,
        couponDiscount: authoritative.couponDiscount,
        cashback: 0,
        loyaltyDiscount: 0,
        paymentMethod: paymentDecision.pricingMethod,
        provider: "mercado_pago" as ProviderId,
        restaurantId: rest.id,
        serviceFeePayer: serviceFeeSettings.serviceFeePayer,
        minimumOrder: (rest as { min_order?: number | null }).min_order ?? null,
      });
    } catch (e) {
      if (e instanceof PricingError) throw new Error(e.message);
      throw e;
    }
    // 4) Criar pedido com status inicial definido pelo tipo de pagamento.
    const { data: order, error: ordErr } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: rest.id,
        customer_id: context.userId,
        customer_name: data.customer.name,
        customer_phone: data.customer.phone,
        address: data.customer.address,
        payment_method: paymentDecision.paymentMethod,
        items: authoritative.items,
        total: pricing.customerTotal,
        discount: pricing.couponDiscount,
        loyalty_discount: 0,
        status: paymentDecision.initialStatus,
      })
      .select("id, order_number, payment_method, status")
      .single();
    if (ordErr) throw new Error(`Falha ao criar pedido: ${ordErr.message}`);

    // 5) Snapshot financeiro (imutável)
    const { error: snapErr } = await supabaseAdmin.from("order_pricing_snapshot").insert({
      order_id: order.id,
      subtotal: pricing.subtotal,
      delivery_fee: pricing.deliveryFee,
      platform_fee: pricing.platformFee,
      service_fee_payer: pricing.serviceFeePayer,
      gateway_fee: pricing.gatewayFee,
      coupon_discount: pricing.couponDiscount,
      cashback: pricing.cashback,
      restaurant_gross: pricing.restaurantGross,
      restaurant_net: pricing.restaurantNet,
      platform_revenue: pricing.platformRevenue,
      realized_platform_revenue: pricing.realizedPlatformRevenue,
      gateway_revenue: pricing.gatewayRevenue,
      customer_total: pricing.customerTotal,
      provider: "mercado_pago",
      currency: pricing.currency,
    });
    if (snapErr) throw new Error(`Falha no snapshot: ${snapErr.message}`);

    // 6) Registro de pagamento via Payment Domain (nenhum SQL local).
    const { registerPendingOrderPayment } = await import("@/lib/payments/orderPayment.server");

    await registerPendingOrderPayment({
      orderId: order.id,
      restaurantId: rest.id,
      paymentMethod: paymentDecision.paymentMethod,
      status: paymentDecision.paymentRecordStatus,
    });

    return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: paymentDecision.initialStatus,
    pricing,
    
    };
  });

export const previewCheckoutPricing = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        subtotal: z.number().nonnegative(),
        deliveryFee: z.number().nonnegative().optional().default(0),
        couponDiscount: z.number().nonnegative().optional().default(0),
        cashback: z.number().nonnegative().optional().default(0),
        loyaltyDiscount: z.number().nonnegative().optional().default(0),
        paymentMethod: z.enum(CHECKOUT_METHODS).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const pricing = await PricingEngine.calculateOrderPricing({
        subtotal: data.subtotal,
        deliveryFee: data.deliveryFee,
        couponDiscount: data.couponDiscount,
        cashback: data.cashback,
        loyaltyDiscount: data.loyaltyDiscount,
        paymentMethod: data.paymentMethod
          ? resolveCheckoutPayment(data.paymentMethod).pricingMethod
          : "pix",
      });
      return { ok: true as const, pricing };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro no cálculo";
      const code = e instanceof PricingError ? e.code : "PRICING_ERROR";
      return { ok: false as const, code, message: msg };
    }
  });
