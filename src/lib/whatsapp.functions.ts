import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
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
  total: z.number().nonnegative(),
  couponId: z.string().uuid().nullable().optional(),
  discount: z.number().nonnegative().optional(),
});

export const buildWhatsappOrderLink = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rest, error } = await supabaseAdmin
      .from("restaurants")
      .select("id, whatsapp_phone, is_open")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error("Falha ao localizar restaurante");
    if (!rest) throw new Error("Restaurante não encontrado");
    if (!rest.is_open) throw new Error("Restaurante fechado no momento");
    const phone = String(rest.whatsapp_phone ?? "").replace(/\D+/g, "");
    if (!phone) throw new Error("WhatsApp do restaurante não configurado");

    await supabaseAdmin.from("orders").insert({
      restaurant_id: rest.id,
      customer_name: data.customer.name,
      customer_phone: data.customer.phone,
      address: data.customer.address,
      payment_method: data.customer.payment,
      items: data.items,
      total: data.total,
      status: "novo",
      coupon_id: data.couponId ?? null,
      discount: data.discount ?? 0,
    });

    return { url: `https://wa.me/${phone}?text=${encodeURIComponent(data.message)}` };
  });
