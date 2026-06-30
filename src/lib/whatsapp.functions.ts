import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  qty: z.number().int().positive(),
});

const inputSchema = z.object({
  slug: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
  customer: z.object({
    name: z.string().min(1).max(120),
    phone: z.string().min(1).max(40),
    address: z.string().min(1).max(400),
    payment: z.string().min(1).max(40),
  }),
  items: z.array(itemSchema).min(1).max(100),
  deliveryFee: z.number().nonnegative().max(10000),
  couponCode: z.string().trim().min(1).max(60).nullable().optional(),
});

export const buildWhatsappOrderLink = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Optional: link order to the authenticated customer when a bearer token is present.
    let customerId: string | null = null;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const auth = req?.headers.get("authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (token && token.split(".").length === 3) {
        const { data: u } = await supabaseAdmin.auth.getUser(token);
        if (u?.user?.id) customerId = u.user.id;
      }
    } catch {}

    const { data: rest, error } = await supabaseAdmin
      .from("restaurants")
      .select("id, whatsapp_phone, is_open, delivery_time")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error("Falha ao localizar restaurante");
    if (!rest) throw new Error("Restaurante não encontrado");
    if (!rest.is_open) throw new Error("Restaurante fechado no momento");
    const phone = String(rest.whatsapp_phone ?? "").replace(/\D+/g, "");
    if (!phone) throw new Error("WhatsApp do restaurante não configurado");
    const eta = Number(rest.delivery_time ?? 35) || 35;

    // Recompute subtotal server-side; trust only the item list shape, not totals.
    const subtotal = data.items.reduce((s, it) => s + it.price * it.qty, 0);

    // Validate coupon and compute discount server-side to prevent tampering.
    let couponId: string | null = null;
    let discount = 0;
    if (data.couponCode) {
      const code = data.couponCode.toUpperCase();
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("id, discount_percent, is_active, valid_until")
        .eq("restaurant_id", rest.id)
        .eq("code", code)
        .maybeSingle();
      if (!coupon || !coupon.is_active) throw new Error("Cupom inválido");
      if (coupon.valid_until && new Date(coupon.valid_until) < new Date(new Date().toDateString())) {
        throw new Error("Cupom expirado");
      }
      couponId = coupon.id;
      discount = Math.round(subtotal * (coupon.discount_percent / 100) * 100) / 100;
    }

    const total = Math.max(0, subtotal - discount) + data.deliveryFee;

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: rest.id,
        customer_id: customerId,
        customer_name: data.customer.name,
        customer_phone: data.customer.phone,
        address: data.customer.address,
        payment_method: data.customer.payment,
        items: data.items,
        total,
        status: "novo",
        coupon_id: couponId,
        discount,
        estimated_delivery_time: eta,
      })
      .select("id, order_number")
      .single();
    if (insErr) throw new Error("Falha ao registrar pedido");

    const orderNumber = inserted?.order_number ?? null;
    const orderId = inserted?.id ?? null;
    const header = orderNumber ? `*Pedido #${orderNumber}*\n\n` : "";
    const fullMessage = header + data.message;

    // Demo account: never trigger real WhatsApp / external integrations.
    const isDemo = data.slug === "demo";

    return {
      url: isDemo
        ? `/pedido-sucesso/${orderId ?? ""}`
        : `https://wa.me/${phone}?text=${encodeURIComponent(fullMessage)}`,
      orderNumber,
      orderId,
      estimatedDeliveryTime: eta,
      demo: isDemo,
    };
  });

