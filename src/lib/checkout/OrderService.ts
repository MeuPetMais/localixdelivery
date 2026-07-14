// OrderService — cria pedido + snapshot financeiro + registro de pagamento.
//
// REGRAS:
// - Todos os cálculos vêm do PricingEngine. Nunca calcular no frontend.
// - Não integra Mercado Pago, não cria Payment Intent, não faz Split.
// - Pagamento online começa em PENDING; pagamento na entrega já fica APPROVED.
// - Snapshot financeiro é imutável (uma linha por pedido).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import PricingEngine, { PricingError, type PaymentMethod, type ProviderId } from "@/lib/payments/PricingEngine";
import { optionalSupabaseAuth } from "@/integrations/supabase/optional-auth-middleware";

const CHECKOUT_METHODS = [
  "pix",
  "credit_card",
  "card_on_delivery",
  "cash",
  "meal_voucher",
  "google_pay",
  "apple_pay",
] as const;
export type CheckoutMethod = (typeof CHECKOUT_METHODS)[number];

// Métodos suportados pelo PricingEngine (subset do checkout).
const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  qty: z.number().int().positive(),
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
    const pricingMethodMap: Record<CheckoutMethod, PaymentMethod> = {
      pix: "pix",
      credit_card: "credit_card",
      card_on_delivery: "credit_card",
      cash: "cash",
      meal_voucher: "credit_card",
      google_pay: "credit_card",
      apple_pay: "credit_card",
    };

    // 1) Validar restaurante ativo + conectado
    const { data: rest, error: restErr } = await supabaseAdmin
      .from("restaurants")
      .select("id, slug, active, is_open, owner_id, min_order")
      .eq("slug", data.restaurantSlug)
      .maybeSingle();
    if (restErr) throw new Error(restErr.message);
    if (!rest) throw new Error("Restaurante não encontrado");
    if (!rest.active) throw new Error("Restaurante inativo");

    // 2) Subtotal a partir dos itens (nunca do frontend)
    const subtotal = data.items.reduce((s, i) => s + i.price * i.qty, 0);

    // 3) Pricing — motor central
    let pricing;
    try {
      pricing = await PricingEngine.calculateOrderPricing({
        subtotal,
        deliveryFee: data.deliveryFee,
        couponDiscount: data.couponDiscount,
        cashback: data.cashback,
        loyaltyDiscount: data.loyaltyDiscount,
        paymentMethod: pricingMethodMap[data.paymentMethod],
        provider: "mercado_pago" as ProviderId,
        restaurantId: rest.id,
        minimumOrder: (rest as { min_order?: number | null }).min_order ?? null,
      });
    } catch (e) {
      if (e instanceof PricingError) throw new Error(e.message);
      throw e;
    }

    // 4) Status inicial depende do meio de pagamento:
    //    - Online (pix, credit_card, google_pay, apple_pay) → "aguardando_pagamento"
    //      até o gateway confirmar.
    //    - Offline (cash, meal_voucher / cartão na entrega) → "pago" (pago fora
    //      do app, já entra na fila de aceite do restaurante).
    const isOnline =
      data.paymentMethod === "pix" ||
      data.paymentMethod === "credit_card" ||
      data.paymentMethod === "google_pay" ||
      data.paymentMethod === "apple_pay";
    const initialStatus: "aguardando_pagamento" | "pago" = isOnline
      ? "aguardando_pagamento"
      : "pago";
    const paymentRecordStatus = isOnline ? "PENDING" : "APPROVED";

    const { data: order, error: ordErr } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: rest.id,
        customer_id: context.userId,
        customer_name: data.customer.name,
        customer_phone: data.customer.phone,
        address: data.customer.address,
        payment_method: data.paymentMethod,
        items: data.items,
        total: pricing.customerTotal,
        discount: pricing.couponDiscount,
        loyalty_discount: data.loyaltyDiscount || 0,
        status: initialStatus,
      })
      .select("id, order_number")
      .single();
    if (ordErr) throw new Error(`Falha ao criar pedido: ${ordErr.message}`);

    // 5) Snapshot financeiro (imutável)
    const { error: snapErr } = await supabaseAdmin.from("order_pricing_snapshot").insert({
      order_id: order.id,
      subtotal: pricing.subtotal,
      delivery_fee: pricing.deliveryFee,
      platform_fee: pricing.platformFee,
      gateway_fee: pricing.gatewayFee,
      coupon_discount: pricing.couponDiscount,
      cashback: pricing.cashback,
      restaurant_gross: pricing.restaurantGross,
      restaurant_net: pricing.restaurantNet,
      platform_revenue: pricing.platformRevenue,
      gateway_revenue: pricing.gatewayRevenue,
      customer_total: pricing.customerTotal,
      provider: "mercado_pago",
      currency: pricing.currency,
    });
    if (snapErr) throw new Error(`Falha no snapshot: ${snapErr.message}`);

    // 6) Registro de pagamento (PENDING) — via Payment Domain (nenhum SQL local).
    const { registerPendingOrderPayment } = await import("@/lib/payments/orderPayment.server");
    await registerPendingOrderPayment({
      orderId: order.id,
      restaurantId: rest.id,
      paymentMethod: data.paymentMethod,
      status: paymentRecordStatus,
    });

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      status: initialStatus,
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
    const pricingMethodMap: Record<CheckoutMethod, PaymentMethod> = {
      pix: "pix",
      credit_card: "credit_card",
      card_on_delivery: "credit_card",
      cash: "cash",
      meal_voucher: "credit_card",
      google_pay: "credit_card",
      apple_pay: "credit_card",
    };
    try {
      const pricing = await PricingEngine.calculateOrderPricing({
        subtotal: data.subtotal,
        deliveryFee: data.deliveryFee,
        couponDiscount: data.couponDiscount,
        cashback: data.cashback,
        loyaltyDiscount: data.loyaltyDiscount,
        paymentMethod: data.paymentMethod
          ? pricingMethodMap[data.paymentMethod]
          : "pix",
      });
      return { ok: true as const, pricing };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro no cálculo";
      const code = e instanceof PricingError ? e.code : "PRICING_ERROR";
      return { ok: false as const, code, message: msg };
    }
  });
