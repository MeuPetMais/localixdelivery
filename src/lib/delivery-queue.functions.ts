// QueueService — Server Functions (RC5.2.a.1)
// Fachada TS para as RPCs SECURITY DEFINER (queue_enqueue, queue_dequeue,
// queue_return, queue_remove, queue_next_driver). Todas exigem sessão
// autenticada. Mutações validam ownership do restaurante ou do próprio
// motoboy.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RestDriverInput = z.object({
  restaurantId: z.string().uuid(),
  driverId: z.string().uuid(),
});

async function assertOwnerOrDriver(
  supabase: any,
  userId: string,
  restaurantId: string,
  driverId: string,
) {
  const { data: rest } = await supabase
    .from("restaurants").select("owner_id").eq("id", restaurantId).maybeSingle();
  if (rest?.owner_id === userId) return;
  const { data: drv } = await supabase
    .from("delivery_drivers").select("owner_id, restaurant_id")
    .eq("id", driverId).maybeSingle();
  if (drv?.owner_id === userId && drv?.restaurant_id === restaurantId) return;
  throw new Error("Sem permissão para operar a fila");
}

export const queueEnqueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RestDriverInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnerOrDriver(context.supabase, context.userId, data.restaurantId, data.driverId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("queue_enqueue", {
      _restaurant_id: data.restaurantId, _driver_id: data.driverId,
    });
    if (error) throw new Error(error.message);
    return { queue_id: id as string };
  });

export const queueRemove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RestDriverInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnerOrDriver(context.supabase, context.userId, data.restaurantId, data.driverId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok, error } = await supabaseAdmin.rpc("queue_remove", {
      _restaurant_id: data.restaurantId, _driver_id: data.driverId,
    });
    if (error) throw new Error(error.message);
    return { ok: ok as boolean };
  });

// Chamadas do orchestrator (assignment) — restritas ao dono do restaurante.
export const queueDequeueForAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RestDriverInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rest } = await context.supabase
      .from("restaurants").select("owner_id").eq("id", data.restaurantId).maybeSingle();
    if (rest?.owner_id !== context.userId) throw new Error("Somente o restaurante pode atribuir entregas");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok, error } = await supabaseAdmin.rpc("queue_dequeue", {
      _restaurant_id: data.restaurantId, _driver_id: data.driverId,
    });
    if (error) throw new Error(error.message);
    return { ok: ok as boolean };
  });

export const queueReturnAfterDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RestDriverInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnerOrDriver(context.supabase, context.userId, data.restaurantId, data.driverId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("queue_return", {
      _restaurant_id: data.restaurantId, _driver_id: data.driverId,
    });
    if (error) throw new Error(error.message);
    return { queue_id: id as string };
  });

export const queueNextDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rest } = await context.supabase
      .from("restaurants").select("owner_id").eq("id", data.restaurantId).maybeSingle();
    if (rest?.owner_id !== context.userId) throw new Error("Sem permissão");
    const { data: rows, error } = await context.supabase.rpc("queue_next_driver", {
      _restaurant_id: data.restaurantId,
    });
    if (error) throw new Error(error.message);
    const first = Array.isArray(rows) ? rows[0] : rows;
    return first ?? null;
  });

export const queueList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("delivery_queue")
      .select("id, restaurant_id, driver_id, position, status, entered_at, left_at")
      .eq("restaurant_id", data.restaurantId)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
