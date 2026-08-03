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
import { CHECKOUT_METHODS, resolveCheckoutPayment } from "./checkout-payment";

export type { CheckoutMethod } from "./checkout-payment";

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

    // 1) Validar restaurante ativo + conectado
    const { data: rest, error: restErr } = await supabaseAdmin
      .from("restaurants")
      .select("id, slug, active, is_open, owner_id, min_order")
      .eq("slug", data.restaurantSlug)
      .maybeSingle();
    if (restErr) throw new Error(restErr.message);
    if (!rest) throw new Error("Restaurante não encontrado");
    if (!rest.active) throw new Error("Restaurante inativo");

    const paymentDecision = resolveCheckoutPayment(data.paymentMethod);

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
        paymentMethod: paymentDecision.pricingMethod,
        provider: "mercado_pago" as ProviderId,
        restaurantId: rest.id,
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
        items: data.items,
        total: pricing.customerTotal,
        discount: pricing.couponDiscount,
        loyalty_discount: data.loyaltyDiscount || 0,
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
