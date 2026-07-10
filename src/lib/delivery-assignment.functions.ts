// RC5.2.a.2 — Server Functions do Delivery Assignment Domain.
// Todas autenticadas via requireSupabaseAuth. Nunca fazem UPDATE direto:
// toda mutação passa pelo DeliveryOrchestrator → RPC atômica CAS.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createDeliveryOrchestrator, type AssignmentSnapshot } from "./delivery/DeliveryOrchestrator";
import {
  DELIVERY_ASSIGNMENT_STATES,
  type DeliveryAssignmentState,
} from "./delivery/DeliveryAssignmentStateMachine";
import type { DeliveryActor } from "./delivery/DeliveryAudit";

const IdInput = z.object({ assignmentId: z.string().uuid() });

const AssignInput = z.object({
  orderId: z.string().uuid(),
  driverId: z.string().uuid(),
  estimatedMinutes: z.number().int().positive().max(600).optional(),
  distanceKm: z.number().nonnegative().max(500).optional(),
});

const CancelInput = IdInput.extend({ reason: z.string().max(500).optional() });

async function requireOwnerOrAdmin(
  supabase: any,
  admin: any,
  userId: string,
  restaurantId: string,
): Promise<{ actor: DeliveryActor }> {
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return { actor: "admin" };
  const { data: rest } = await supabase
    .from("restaurants").select("owner_id").eq("id", restaurantId).maybeSingle();
  if (rest?.owner_id === userId) return { actor: "restaurant" };
  throw new Error("FORBIDDEN");
}

async function requireDriverOwnerOrAdmin(
  supabase: any,
  admin: any,
  userId: string,
  assignment: AssignmentSnapshot,
): Promise<{ actor: DeliveryActor; actorId: string }> {
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return { actor: "admin", actorId: userId };
  const { data: drv } = await supabase
    .from("delivery_drivers").select("owner_id").eq("id", assignment.driver_id).maybeSingle();
  if (drv?.owner_id === userId) return { actor: "driver", actorId: userId };
  const { data: rest } = await supabase
    .from("restaurants").select("owner_id").eq("id", assignment.restaurant_id).maybeSingle();
  if (rest?.owner_id === userId) return { actor: "restaurant", actorId: userId };
  throw new Error("FORBIDDEN");
}

async function buildOrchestrator() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return {
    admin: supabaseAdmin,
    orchestrator: createDeliveryOrchestrator({
      getAssignment: async (id) => {
        const { data } = await supabaseAdmin
          .from("delivery_assignments")
          .select("id, order_id, restaurant_id, driver_id, status, correlation_id")
          .eq("id", id)
          .maybeSingle();
        if (!data) return null;
        return data as AssignmentSnapshot;
      },
      applyAtomic: async (input) => {
        const { data, error } = await supabaseAdmin.rpc("delivery_assignment_apply_transition" as never, {
          _assignment_id: input.assignmentId,
          _expected_from: input.expectedFrom,
          _next_status: input.nextStatus,
          _actor: input.actor,
          _actor_id: input.actorId,
          _reason: input.reason,
          _correlation_id: input.correlationId,
          _metadata: input.metadata,
        } as never);
        if (error) return { ok: false, reason: error.message };
        const res = data as unknown as { ok: boolean; reason?: string; current?: string };
        return res;
      },
      onAssigned: async (a) => {
        // Remove motoboy da fila operacional
        await supabaseAdmin.rpc("queue_dequeue", {
          _restaurant_id: a.restaurant_id, _driver_id: a.driver_id,
        });
      },
      onCollected: async (a) => {
        // Order Domain: saiu_para_entrega
        await supabaseAdmin.rpc("order_apply_transition", {
          _order_id: a.order_id,
          _expected_from: "pronto",
          _next_status: "saiu_para_entrega",
          _reason: "Motoboy coletou o pedido",
          _actor_type: "courier",
          _actor_id: null as unknown as string,
          _metadata: { assignment_id: a.id, correlation_id: a.correlation_id },
        });
      },
      onDelivered: async (a) => {
        await supabaseAdmin.rpc("order_apply_transition", {
          _order_id: a.order_id,
          _expected_from: "saiu_para_entrega",
          _next_status: "entregue",
          _reason: "Entrega concluída",
          _actor_type: "courier",
          _actor_id: null as unknown as string,
          _metadata: { assignment_id: a.id, correlation_id: a.correlation_id },
        });
        // Retorna motoboy ao final da fila
        await supabaseAdmin.rpc("queue_return", {

          _restaurant_id: a.restaurant_id, _driver_id: a.driver_id,
        });
      },
    }),
  };
}

// -------- assignDelivery --------
export const assignDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AssignInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders").select("id, restaurant_id").eq("id", data.orderId).maybeSingle();
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const { actor } = await requireOwnerOrAdmin(
      context.supabase, supabaseAdmin, context.userId, order.restaurant_id!,
    );

    const { data: driver } = await supabaseAdmin
      .from("delivery_drivers")
      .select("id, restaurant_id, status")
      .eq("id", data.driverId).maybeSingle();
    if (!driver || driver.restaurant_id !== order.restaurant_id) throw new Error("DRIVER_NOT_FOUND");
    if (driver.status !== "ativo") throw new Error("DRIVER_INACTIVE");

    const correlationId = crypto.randomUUID();
    const { data: created, error: insErr } = await supabaseAdmin
      .from("delivery_assignments")
      .insert({
        order_id: data.orderId,
        restaurant_id: order.restaurant_id,
        driver_id: data.driverId,
        status: "PENDENTE",
        assigned_by: context.userId,
        estimated_minutes: data.estimatedMinutes ?? null,
        distance_km: data.distanceKm ?? null,
        correlation_id: correlationId,
      })
      .select("id, order_id, restaurant_id, driver_id, status, correlation_id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const { orchestrator } = await buildOrchestrator();
    const res = await orchestrator.transition({
      assignmentId: created.id,
      to: "ATRIBUIDO",
      audit: { actor, actorId: context.userId, correlationId },
      metadata: { estimated_minutes: data.estimatedMinutes, distance_km: data.distanceKm },
    });
    if (!res.ok) throw new Error(`ASSIGN_FAILED:${res.reason}`);
    return { ok: true, assignmentId: created.id, correlationId };
  });

// -------- collectDelivery --------
export const collectDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { orchestrator, admin } = await buildOrchestrator();
    const snap = await orchestrator["transition"]; // keep types happy
    void snap;
    const { data: existing } = await admin
      .from("delivery_assignments")
      .select("id, order_id, restaurant_id, driver_id, status, correlation_id")
      .eq("id", data.assignmentId).maybeSingle();
    if (!existing) throw new Error("ASSIGNMENT_NOT_FOUND");
    const { actor, actorId } = await requireDriverOwnerOrAdmin(
      context.supabase, admin, context.userId, existing as AssignmentSnapshot,
    );
    const res = await orchestrator.transition({
      assignmentId: data.assignmentId,
      to: "COLETANDO",
      audit: { actor, actorId, correlationId: existing.correlation_id },
    });
    if (!res.ok) throw new Error(`COLLECT_FAILED:${res.reason}`);
    return { ok: true };
  });

// -------- departDelivery --------
export const departDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { orchestrator, admin } = await buildOrchestrator();
    const { data: existing } = await admin
      .from("delivery_assignments")
      .select("id, order_id, restaurant_id, driver_id, status, correlation_id")
      .eq("id", data.assignmentId).maybeSingle();
    if (!existing) throw new Error("ASSIGNMENT_NOT_FOUND");
    const { actor, actorId } = await requireDriverOwnerOrAdmin(
      context.supabase, admin, context.userId, existing as AssignmentSnapshot,
    );
    const res = await orchestrator.transition({
      assignmentId: data.assignmentId,
      to: "EM_ROTA",
      audit: { actor, actorId, correlationId: existing.correlation_id },
    });
    if (!res.ok) throw new Error(`DEPART_FAILED:${res.reason}`);
    return { ok: true };
  });

// -------- deliverDelivery --------
export const deliverDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { orchestrator, admin } = await buildOrchestrator();
    const { data: existing } = await admin
      .from("delivery_assignments")
      .select("id, order_id, restaurant_id, driver_id, status, correlation_id")
      .eq("id", data.assignmentId).maybeSingle();
    if (!existing) throw new Error("ASSIGNMENT_NOT_FOUND");
    const { actor, actorId } = await requireDriverOwnerOrAdmin(
      context.supabase, admin, context.userId, existing as AssignmentSnapshot,
    );
    const res = await orchestrator.transition({
      assignmentId: data.assignmentId,
      to: "ENTREGUE",
      audit: { actor, actorId, correlationId: existing.correlation_id },
    });
    if (!res.ok) throw new Error(`DELIVER_FAILED:${res.reason}`);
    return { ok: true };
  });

// -------- cancelDelivery --------
export const cancelDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CancelInput.parse(d))
  .handler(async ({ data, context }) => {
    const { orchestrator, admin } = await buildOrchestrator();
    const { data: existing } = await admin
      .from("delivery_assignments")
      .select("id, order_id, restaurant_id, driver_id, status, correlation_id")
      .eq("id", data.assignmentId).maybeSingle();
    if (!existing) throw new Error("ASSIGNMENT_NOT_FOUND");
    const { actor, actorId } = await requireDriverOwnerOrAdmin(
      context.supabase, admin, context.userId, existing as AssignmentSnapshot,
    );
    const res = await orchestrator.transition({
      assignmentId: data.assignmentId,
      to: "CANCELADO",
      reason: data.reason,
      audit: { actor, actorId, correlationId: existing.correlation_id },
    });
    if (!res.ok) throw new Error(`CANCEL_FAILED:${res.reason}`);
    return { ok: true };
  });

// -------- listAssignments --------
export const listAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      restaurantId: z.string().uuid(),
      status: z.enum([...DELIVERY_ASSIGNMENT_STATES] as [DeliveryAssignmentState, ...DeliveryAssignmentState[]]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("delivery_assignments")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// -------- getAssignmentTimeline --------
export const getAssignmentTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("delivery_assignment_timeline")
      .select("*")
      .eq("assignment_id", data.assignmentId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
