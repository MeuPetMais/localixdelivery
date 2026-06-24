import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  slug: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
});

export const buildWhatsappOrderLink = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rest, error } = await supabaseAdmin
      .from("restaurants")
      .select("whatsapp_phone, is_open")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error("Falha ao localizar restaurante");
    if (!rest) throw new Error("Restaurante não encontrado");
    if (!rest.is_open) throw new Error("Restaurante fechado no momento");
    const phone = String(rest.whatsapp_phone ?? "").replace(/\D+/g, "");
    if (!phone) throw new Error("WhatsApp do restaurante não configurado");
    return { url: `https://wa.me/${phone}?text=${encodeURIComponent(data.message)}` };
  });
