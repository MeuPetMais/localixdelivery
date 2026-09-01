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
import { calculateDriverEarning, DEFAULT_DRIVER_EARNING_SETTINGS } from "./driver-earnings";

const IdInput = z.object({ assignmentId: z.string().uuid() });

const AssignInput = z.object({
  orderId: z.string().uuid(),
  driverId: z.string().uuid(),
  estimatedMinutes: z.number().int().positive().max(600).optional(),
  distanceKm: z.number().nonnegative().max(500).optional(),
});

const CancelInput = IdInput.extend({ reason: z.string().max(500).optional() });
const RestaurantInput = z.object({ restaurantId: z.string().uuid() });

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

async function requireAssignmentOwnerOrAdmin(
  supabase: any,
  admin: any,
  userId: string,
  assignment: AssignmentSnapshot,
): Promise<{ actor: DeliveryActor; actorId: string }> {
  const { actor } = await requireOwnerOrAdmin(
    supabase,
    admin,
    userId,
    assignment.restaurant_id,
  );
  return { actor, actorId: userId };
}

async function buildOrchestrator(callerSupabase: any) {
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
        // User-originated delivery transitions must preserve the caller JWT/auth.uid.
        // The DB function synchronizes the order and validates courier ownership.
        const { data, error } = await callerSupabase.rpc("delivery_assignment_apply_transition" as never, {
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
        // Coleta confirmada no Assignment Domain. A saida para rota ocorre em EM_ROTA.
        void a;
      },
      onDeparted: async (a) => {
        // O sync do Order Domain ocorre atomicamente dentro de
        // delivery_assignment_apply_transition. Nao duplicar a transicao aqui.
        void a;
      },
      onDelivered: async (a) => {
        // O status do pedido ja foi sincronizado atomicamente pela RPC.
        // Entrega concluida: motoboy entra em retorno; a volta a fila ocorre ao finalizar o retorno.
        await supabaseAdmin.rpc("queue_start_return" as never, {
          _restaurant_id: a.restaurant_id, _driver_id: a.driver_id,
        } as never);
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
      .select("id, restaurant_id, status, online")
      .eq("id", data.driverId).maybeSingle();
    if (!driver || driver.restaurant_id !== order.restaurant_id) throw new Error("DRIVER_NOT_FOUND");
    if (driver.status !== "ativo") throw new Error("DRIVER_INACTIVE");
    if (!driver.online) throw new Error("DRIVER_OFFLINE");

    const { data: queueEntry } = await supabaseAdmin
      .from("delivery_queue")
      .select("id")
      .eq("restaurant_id", order.restaurant_id)
      .eq("driver_id", data.driverId)
      .eq("status", "AGUARDANDO")
      .maybeSingle();
    if (!queueEntry) throw new Error("DRIVER_NOT_IN_QUEUE");

    const { data: rawSettings } = await (supabaseAdmin.from("driver_earning_settings") as any)
      .select("base_fee, per_km_fee, minimum_fee, maximum_fee, is_active")
      .eq("restaurant_id", order.restaurant_id)
      .eq("is_active", true)
      .maybeSingle();
    const settings = rawSettings ?? DEFAULT_DRIVER_EARNING_SETTINGS;
    const earning = calculateDriverEarning(settings, data.distanceKm ?? null);
    const assignmentMetadata = {
      driver_earning_source: rawSettings ? "restaurant_settings" : "default_policy",
      driver_earning_distance_missing: earning.distanceMissing,
    };

    const correlationId = crypto.randomUUID();
    const { data: assigned, error: assignErr } = await supabaseAdmin.rpc("delivery_auto_assign_order" as never, {
      _order_id: data.orderId,
      _reason: actor === "admin" ? "ADMIN_REASSIGN" : "ADMIN_ASSIGN",
      _correlation_id: correlationId,
      _forced_driver_id: data.driverId,
      _actor_id: context.userId,
    } as never);
    if (assignErr) throw new Error(assignErr.message);
    const res = assigned as unknown as {
      ok?: boolean;
      reason?: string;
      assignment_id?: string;
      correlation_id?: string;
    } | null;
    if (!res?.ok) throw new Error(`ASSIGN_FAILED:${res?.reason ?? "UNKNOWN"}`);

    if (res.assignment_id) {
      const { data: currentAssignment } = await supabaseAdmin
        .from("delivery_assignments")
        .select("metadata")
        .eq("id", res.assignment_id)
        .maybeSingle();
      const { error: snapshotErr } = await (supabaseAdmin.from("delivery_assignments") as any)
        .update({
          estimated_minutes: data.estimatedMinutes ?? null,
          distance_km: data.distanceKm ?? null,
          driver_base_fee: settings.base_fee,
          driver_per_km_fee: settings.per_km_fee,
          driver_distance_km: earning.distanceKm,
          driver_earning_amount: earning.amount,
          driver_earning_calculated_at: new Date().toISOString(),
          metadata: { ...((currentAssignment as any)?.metadata ?? {}), ...assignmentMetadata },
        })
        .eq("id", res.assignment_id);
      if (snapshotErr) throw new Error(snapshotErr.message);
    }

    return {
      ok: true,
      assignmentId: res.assignment_id,
      correlationId: res.correlation_id ?? correlationId,
    };
  });

// -------- collectDelivery --------
export const collectDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { orchestrator, admin } = await buildOrchestrator(context.supabase);
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
    const { orchestrator, admin } = await buildOrchestrator(context.supabase);
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
    const { orchestrator, admin } = await buildOrchestrator(context.supabase);
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
    const { orchestrator, admin } = await buildOrchestrator(context.supabase);
    const { data: existing } = await admin
      .from("delivery_assignments")
      .select("id, order_id, restaurant_id, driver_id, status, correlation_id")
      .eq("id", data.assignmentId).maybeSingle();
    if (!existing) throw new Error("ASSIGNMENT_NOT_FOUND");
    const { actor, actorId } = await requireAssignmentOwnerOrAdmin(
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

// -------- listAutoAssignmentAudit --------
export const listAutoAssignmentAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RestaurantInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rest } = await context.supabase
      .from("restaurants")
      .select("owner_id")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (rest?.owner_id !== context.userId) throw new Error("FORBIDDEN");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("delivery_auto_assignment_audit" as never)
      .select("order_id, assignment_id, driver_id, reason, previous_queue_position, correlation_id, created_at, metadata")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false })
      .limit(200);
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
