import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  return supabaseAdmin;
}

const tierSchema = z.object({
  label: z.string().min(1),
  min: z.number().min(0),
  max: z.number().nullable().optional(),
  fee: z.number().min(0),
});
const citySchema = z.object({
  city: z.string().min(1),
  fee: z.number().min(0),
});

const settingsSchema = z.object({
  name: z.string().min(1).max(120),
  logo_url: z.string().url().nullable().optional().or(z.literal("")),
  banner_url: z.string().url().nullable().optional().or(z.literal("")),
  primary_color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).nullable().optional(),
  contact_email: z.string().email().nullable().optional().or(z.literal("")),
  contact_whatsapp: z.string().max(30).nullable().optional().or(z.literal("")),
  domain: z.string().max(120).nullable().optional().or(z.literal("")),
  commission_rate: z.number().min(0).max(1),
  fixed_fee: z.number().min(0).max(999),
  min_order: z.number().min(0).max(9999),
  delivery_fee_default: z.number().min(0).max(999),
  tier_fees: z.array(tierSchema).max(20),
  city_fees: z.array(citySchema).max(200),
});

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await assertAdmin(context.userId);
    const { data, error } = await sb.from("platform_settings" as any).select("*").eq("id", true).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = await assertAdmin(context.userId);
    const payload = {
      ...data,
      logo_url: data.logo_url || null,
      banner_url: data.banner_url || null,
      contact_email: data.contact_email || null,
      contact_whatsapp: data.contact_whatsapp || null,
      domain: data.domain || null,
      updated_by: context.userId,
    };
    const { error } = await sb.from("platform_settings" as any).update(payload).eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
