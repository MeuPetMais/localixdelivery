import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  slug: z.string().min(1).max(120),
  code: z.string().min(1).max(40),
});

export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!rest) return { valid: false as const, reason: "Restaurante não encontrado" };

    const { data: coupon } = await supabaseAdmin
      .from("coupons")
      .select("id, code, discount_percent, valid_until, is_active")
      .eq("restaurant_id", rest.id)
      .ilike("code", data.code.trim())
      .maybeSingle();

    if (!coupon) return { valid: false as const, reason: "Cupom inválido" };
    if (!coupon.is_active) return { valid: false as const, reason: "Cupom desativado" };
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date(new Date().toDateString())) {
      return { valid: false as const, reason: "Cupom expirado" };
    }
    return { valid: true as const, id: coupon.id, code: coupon.code, discountPercent: coupon.discount_percent };
  });
