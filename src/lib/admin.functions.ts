import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify admin role via service-role read on user_roles (bypasses RLS safely server-side).
    const { data: adminRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!adminRow) throw new Error("Forbidden");


    const [restaurantsTotal, restaurantsActive, ordersAll] = await Promise.all([
      supabaseAdmin.from("restaurants").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("restaurants").select("id", { count: "exact", head: true }).eq("is_open", true),
      supabaseAdmin.from("orders").select("total, status, created_at, restaurant_id"),
    ]);

    if (ordersAll.error) throw new Error(ordersAll.error.message);

    const orders = ordersAll.data ?? [];
    const revenue = orders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);

    // Platform fee model: 2% of GMV (sample). Adjust freely.
    const platformRevenue = revenue * 0.02;

    return {
      restaurantsTotal: restaurantsTotal.count ?? 0,
      restaurantsActive: restaurantsActive.count ?? 0,
      ordersTotal: orders.length,
      gmv: revenue,
      platformRevenue,
    };
  });

export const getRecentRestaurants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: adminRow } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Forbidden");

    const { data, error } = await supabaseAdmin

      .from("restaurants")
      .select("id, name, slug, is_open, created_at, whatsapp_phone")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
