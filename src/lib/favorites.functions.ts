import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const phoneSchema = z.object({ phone: z.string().min(8).max(40) });
const toggleSchema = z.object({
  phone: z.string().min(8).max(40),
  restaurantId: z.string().uuid(),
});

const normalize = (p: string) => p.replace(/\D+/g, "");

export const listFavorites = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => phoneSchema.parse(d))
  .handler(async ({ data }) => {
    const phone = normalize(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: favs } = await supabaseAdmin
      .from("customer_favorites")
      .select("restaurant_id")
      .eq("phone", phone);
    const ids = (favs ?? []).map((f) => f.restaurant_id);
    if (ids.length === 0) return { favorites: [] as Array<{ id: string; name: string; slug: string }> };
    const { data: rests } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, slug")
      .in("id", ids);
    return { favorites: rests ?? [] };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => toggleSchema.parse(d))
  .handler(async ({ data }) => {
    const phone = normalize(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("customer_favorites")
      .select("id")
      .eq("phone", phone)
      .eq("restaurant_id", data.restaurantId)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("customer_favorites").delete().eq("id", existing.id);
      return { favorited: false };
    }
    await supabaseAdmin.from("customer_favorites").insert({ phone, restaurant_id: data.restaurantId });
    return { favorited: true };
  });
