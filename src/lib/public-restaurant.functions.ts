import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  slug: z.string().min(1).max(120),
});

function maskPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.length <= 4) return digits;
  const visibleStart = digits.length > 11 ? 4 : 2;
  return `${digits.slice(0, visibleStart)} •••••-${digits.slice(-4)}`;
}

export const getPublicRestaurantWhatsApp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rest, error } = await supabaseAdmin
      .from("restaurants")
      .select("whatsapp_phone")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();

    if (error) throw new Error("Falha ao carregar contato do estabelecimento");

    const maskedPhone = maskPhone(rest?.whatsapp_phone);
    return {
      hasWhatsApp: !!maskedPhone,
      maskedPhone,
    };
  });
