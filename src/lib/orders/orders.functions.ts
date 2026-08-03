// Server function oficial para transitar status de pedidos.
// TODA mudança em orders.status vinda do frontend passa por aqui.
// Persistência via supabaseAdmin (autor já verificado por requireSupabaseAuth).
import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ORDER_STATES, type OrderState } from "./OrderStateMachine";
import { createOrchestrator, type OrderSnapshot } from "./OrderOrchestrator";
import type { OrderActorType } from "./OrderPermissions";

const ActorSchema = z.enum([
  "customer",
  "restaurant",
  "admin",
  "system",
  "webhook",
  "courier",
]);

const InputSchema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(ORDER_STATES as [OrderState, ...OrderState[]]),
  reason: z.string().max(500).optional(),
  actorType: ActorSchema.optional(),
});

export const transitionOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Verifica se o chamador é dono do restaurante do pedido OU admin.
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderErr) throw new Error(orderErr.message);
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    let actorType: OrderActorType = data.actorType ?? "restaurant";
    if (isAdmin) {
      actorType = data.actorType ?? "admin";
    } else {
      const { data: rest } = await supabaseAdmin
        .from("restaurants")
        .select("owner_id")
        .eq("id", order.restaurant_id!)
        .maybeSingle();
      if (!rest || rest.owner_id !== userId) throw new Error("FORBIDDEN");
    }

    const orchestrator = createOrchestrator({
      getOrder: async (id): Promise<OrderSnapshot | null> => {
        const { data: o } = await supabaseAdmin
          .from("orders")
          .select("id, restaurant_id, status")
          .eq("id", id)
          .maybeSingle();
        if (!o) return null;
        return {
          id: o.id,
          restaurant_id: o.restaurant_id,
          status: o.status as OrderState,
        };
      },
      updateOrderStatus: async (id, next) => {
        const { error } = await supabaseAdmin
          .from("orders")
          .update({ status: next })
          .eq("id", id);
        if (error) throw new Error(error.message);
      },
      insertHistory: async (row) => {
        const { error } = await supabaseAdmin
          .from("order_status_history")
          .insert(row as never);
        if (error) throw new Error(error.message);
      },
    });

    const result = await orchestrator.transition({
      orderId: data.orderId,
      to: data.to,
      reason: data.reason,
      audit: {
        actorType,
        userId,
        service: "orders.transitionOrderStatus",
      },
    });

    if (!result.ok) {
      throw new Error(`TRANSITION_REJECTED:${result.reason ?? "UNKNOWN"}`);
    }
    if (result.to === "pronto" && order.restaurant_id) {
      const correlationId = randomUUID();
      const { error: assignErr } = await supabaseAdmin.rpc("delivery_auto_assign_order" as never, {
        _order_id: data.orderId,
        _reason: "ORDER_READY",
        _correlation_id: correlationId,
        _forced_driver_id: null,
        _actor_id: userId,
      } as never);
      if (assignErr) {
        console.error("[orders.transitionOrderStatus] auto assignment failed", {
          orderId: data.orderId,
          restaurantId: order.restaurant_id,
          message: assignErr.message,
          correlationId,
        });
      }
    }
    return result;
  });
