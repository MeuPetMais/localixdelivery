import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyDriverContexts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: memberships, error } = await context.supabase
      .from("driver_restaurant_memberships" as never)
      .select("driver_id, restaurant_id, status" as never)
      .eq("owner_id" as never, context.userId)
      .eq("status" as never, "ativo");
    if (error) throw new Error(error.message);

    const rows = (memberships ?? []) as unknown as Array<{
      driver_id: string;
      restaurant_id: string;
      status: string;
    }>;
    if (!rows.length) return { contexts: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const driverIds = rows.map((r) => r.driver_id);
    const restaurantIds = rows.map((r) => r.restaurant_id);

    const [{ data: drivers, error: driversErr }, { data: restaurants, error: restaurantsErr }] = await Promise.all([
      supabaseAdmin
        .from("delivery_drivers")
        .select("id, restaurant_id, owner_id, name, status, online")
        .in("id", driverIds),
      supabaseAdmin
        .from("restaurants")
        .select("id, name, logo_url")
        .in("id", restaurantIds),
    ]);
    if (driversErr) throw new Error(driversErr.message);
    if (restaurantsErr) throw new Error(restaurantsErr.message);

    const dMap = new Map((drivers ?? []).map((d) => [d.id, d]));
    const rMap = new Map((restaurants ?? []).map((r) => [r.id, r]));

    return {
      contexts: rows.map((m) => {
        const driver = dMap.get(m.driver_id);
        const restaurant = rMap.get(m.restaurant_id);
        return {
          driverId: m.driver_id,
          restaurantId: m.restaurant_id,
          restaurantName: restaurant?.name ?? "Estabelecimento",
          restaurantLogoUrl: restaurant?.logo_url ?? null,
          driverName: driver?.name ?? "Entregador",
          driverStatus: driver?.status ?? "inativo",
          online: !!driver?.online,
          selected: driver?.owner_id === context.userId,
        };
      }),
    };
  });

export const switchMyDriverContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ driverId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RPC revalida auth.uid() e o membership. Nao aceita owner_id enviado pelo cliente.
    const { data: result, error } = await context.supabase.rpc(
      "driver_switch_restaurant_context" as never,
      { _driver_id: data.driverId } as never,
    );
    if (error) throw new Error(error.message);
    const parsed = result as unknown as { ok?: boolean; reason?: string } | null;
    if (!parsed?.ok) {
      const messages: Record<string, string> = {
        CURRENT_CONTEXT_ONLINE: "Fique offline antes de trocar de estabelecimento.",
        CURRENT_CONTEXT_HAS_ACTIVE_ASSIGNMENT: "Finalize a entrega atual antes de trocar de estabelecimento.",
        CURRENT_CONTEXT_IN_QUEUE: "Saia da fila antes de trocar de estabelecimento.",
        MEMBERSHIP_NOT_FOUND: "Este estabelecimento não está vinculado à sua conta.",
      };
      throw new Error(messages[parsed?.reason ?? ""] ?? "Não foi possível trocar de estabelecimento.");
    }
    return parsed;
  });
