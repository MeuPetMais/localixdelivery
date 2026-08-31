// Server function oficial para transitar status de pedidos.
// TODA mudança em orders.status vinda do frontend passa por aqui.
// Persistência da transição usa o cliente autenticado do middleware para preservar auth.uid() na RPC.
import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ORDER_STATES, type OrderState } from "./OrderStateMachine";
import { createOrchestrator, type OrderSnapshot } from "./OrderOrchestrator";
import type { OrderActorType } from "./OrderPermissions";
import { validateDirectDeliveryStatusTransition } from "./delivery-transition-guard";

const ActorSchema = z.enum(["customer", "restaurant", "admin", "system", "webhook", "courier"]);

const InputSchema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(ORDER_STATES as [OrderState, ...OrderState[]]),
  reason: z.string().max(500).optional(),
  actorType: ActorSchema.optional(),
});
const CancelInputSchema = z.object({
  orderId: z.string().uuid(),
});

function isApprovedMercadoPagoPayment(payment: any): boolean {
  return (
    String(payment?.provider ?? "") === "mercado_pago" &&
    String(payment?.status ?? "").toUpperCase() === "APPROVED" &&
    !!String(payment?.payment_id ?? "").trim()
  );
}

export const transitionOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Verifica se o chamador é dono do restaurante do pedido OU admin.
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, status, address")
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

    if (data.to === "saiu_para_entrega" || data.to === "entregue") {
      const { data: assignment, error: assignmentErr } = await supabaseAdmin
        .from("delivery_assignments")
        .select("id, status")
        .eq("order_id", data.orderId)
        .in("status", ["ATRIBUIDO", "COLETANDO", "EM_ROTA"])
        .maybeSingle();
      if (assignmentErr) throw new Error(assignmentErr.message);

      const guard = validateDirectDeliveryStatusTransition({
        order,
        nextStatus: data.to,
        assignment,
      });
      if (!guard.ok) {
        throw new Error(`${guard.code}:${guard.message}`);
      }
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
      updateOrderStatus: async () => {},
      insertHistory: async () => {},
      applyAtomic: async (row) => {
        // A RPC valida auth.uid() novamente; preserve o JWT do usuário autenticado.
        const { data: applied, error } = await context.supabase.rpc("order_apply_transition", {
          _order_id: row.order_id,
          _expected_from: row.expected_from,
          _next_status: row.next_status,
          _reason: row.reason,
          _actor_type: row.performed_by_type,
          _actor_id: row.performed_by,
          _metadata: row.metadata,
        } as never);
        if (error) throw new Error(`RPC_FAILED:${error.message}`);
        const result = applied as unknown as { ok?: boolean; reason?: string } | null;
        if (!result?.ok) {
          throw new Error(`RPC_REJECTED:${result?.reason ?? "UNKNOWN"}`);
        }
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
      const { error: assignErr } = await supabaseAdmin.rpc(
        "delivery_auto_assign_order" as never,
        {
          _order_id: data.orderId,
          _reason: "ORDER_READY",
          _correlation_id: correlationId,
          _forced_driver_id: null,
          _actor_id: userId,
        } as never,
      );
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

export const cancelRestaurantOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CancelInputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

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
    const actorType: OrderActorType = isAdmin ? "admin" : "restaurant";
    if (!isAdmin) {
      const { data: rest } = await supabaseAdmin
        .from("restaurants")
        .select("owner_id")
        .eq("id", order.restaurant_id!)
        .maybeSingle();
      if (!rest || rest.owner_id !== userId) throw new Error("FORBIDDEN");
    }

    const { data: payment, error: paymentErr } = await supabaseAdmin
      .from("order_payment")
      .select("provider, status, payment_id, payment_method")
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (paymentErr) throw new Error(paymentErr.message);

    if (isApprovedMercadoPagoPayment(payment)) {
      const { data: refund, error: refundErr } = await supabaseAdmin.functions.invoke(
        "mp-payment-intent",
        {
          body: { action: "refund", order_id: data.orderId },
        },
      );
      if (refundErr) throw new Error(refundErr.message);
      if (refund?.error) throw new Error(String(refund.error));
      if (refund?.status !== "REFUNDED") throw new Error("REFUND_NOT_CONFIRMED");
      return {
        ok: true as const,
        status: "reembolsado" as OrderState,
        refunded: true,
        payment_id: refund.payment_id ?? null,
        refund_id: refund.refund_id ?? null,
      };
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
      updateOrderStatus: async () => {},
      insertHistory: async () => {},
      applyAtomic: async (row) => {
        // A RPC valida auth.uid() novamente; preserve o JWT do usuário autenticado.
        const { data: applied, error } = await context.supabase.rpc("order_apply_transition", {
          _order_id: row.order_id,
          _expected_from: row.expected_from,
          _next_status: row.next_status,
          _reason: row.reason,
          _actor_type: row.performed_by_type,
          _actor_id: row.performed_by,
          _metadata: row.metadata,
        } as never);
        if (error) throw new Error(`RPC_FAILED:${error.message}`);
        const result = applied as unknown as { ok?: boolean; reason?: string } | null;
        if (!result?.ok) {
          throw new Error(`RPC_REJECTED:${result?.reason ?? "UNKNOWN"}`);
        }
      },
    });

    const result = await orchestrator.transition({
      orderId: data.orderId,
      to: "cancelado",
      reason: "restaurant_cancelled",
      audit: {
        actorType,
        userId,
        service: "orders.cancelRestaurantOrder",
      },
    });

    if (!result.ok) {
      throw new Error(`TRANSITION_REJECTED:${result.reason ?? "UNKNOWN"}`);
    }
    return { ok: true as const, status: "cancelado" as OrderState, refunded: false };
  });
