// RC5.2.f — Driver Shift server functions.
// Toda mutação passa pelo motoboy autenticado (owner_id = context.userId).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accumulate, ZERO_ACC, type ShiftAccumulators } from "@/lib/delivery/DriverShiftService";
import {
  EVENT_TO_STATE,
  type ShiftCurrentState,
  type ShiftEvent,
} from "@/lib/delivery/DriverShiftStateMachine";
import { z } from "zod";

const eventSchema = z.object({
  event: z.enum([
    "QUEUE_ENTERED",
    "DELIVERY_ASSIGNED",
    "DELIVERY_COLLECTED",
    "DELIVERY_STARTED",
    "DELIVERY_FINISHED",
    "RETURN_STARTED",
    "RETURN_FINISHED",
    "PAUSE_STARTED",
    "PAUSE_FINISHED",
  ]),
  metadata: z.record(z.any()).optional(),
  correlationId: z.string().uuid().optional(),
});

type ShiftRow = {
  id: string;
  driver_id: string;
  restaurant_id: string;
  started_at: string;
  finished_at: string | null;
  status: "ATIVO" | "PAUSADO" | "FINALIZADO";
  current_state: ShiftCurrentState;
  deliveries_count: number;
  earnings_total: number;
  distance_total_km: number;
  online_minutes: number;
  waiting_minutes: number;
  delivery_minutes: number;
  return_minutes: number;
  pause_minutes: number;
  metadata: Record<string, unknown>;
  updated_at: string;
};

async function loadDriver(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("delivery_drivers")
    .select("id, restaurant_id, status")
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  if (!data) throw new Error("Motoboy não encontrado");
  return data as { id: string; restaurant_id: string; status: string };
}

async function loadOpenShift(supabase: any, driverId: string): Promise<ShiftRow | null> {
  const { data } = await supabase
    .from("driver_shifts")
    .select("*")
    .eq("driver_id", driverId)
    .neq("status", "FINALIZADO")
    .order("started_at", { ascending: false })
    .limit(1);
  return (data?.[0] as ShiftRow) ?? null;
}

async function insertTimeline(
  supabase: any,
  shiftId: string,
  event: ShiftEvent,
  prev: ShiftCurrentState | null,
  next: ShiftCurrentState | null,
  actorId: string,
  metadata: Record<string, unknown> = {},
  correlationId?: string,
) {
  await supabase.from("driver_shift_timeline").insert({
    shift_id: shiftId,
    event,
    previous_state: prev,
    current_state: next,
    actor: "driver",
    correlation_id: correlationId ?? null,
    metadata: { ...metadata, actor_id: actorId },
  });
}

/**
 * Aplica transição de estado do turno acumulando o tempo do estado anterior.
 * Sempre passa por aqui — nunca escreva `current_state` cru.
 */
async function applyTransition(
  supabase: any,
  shift: ShiftRow,
  nextState: ShiftCurrentState,
  event: ShiftEvent,
  actorId: string,
  metadata: Record<string, unknown> = {},
  correlationId?: string,
): Promise<ShiftRow> {
  const acc: ShiftAccumulators = {
    online_minutes: shift.online_minutes,
    waiting_minutes: shift.waiting_minutes,
    delivery_minutes: shift.delivery_minutes,
    return_minutes: shift.return_minutes,
    pause_minutes: shift.pause_minutes,
  };
  const updated = accumulate(acc, shift.current_state, shift.updated_at, new Date());
  const patch: Partial<ShiftRow> = {
    ...updated,
    current_state: nextState,
  };
  if (event === "PAUSE_STARTED") patch.status = "PAUSADO";
  if (event === "PAUSE_FINISHED") patch.status = "ATIVO";
  const { data, error } = await supabase
    .from("driver_shifts")
    .update(patch)
    .eq("id", shift.id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await insertTimeline(supabase, shift.id, event, shift.current_state, nextState, actorId, metadata, correlationId);
  return data as ShiftRow;
}

export const startShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const driver = await loadDriver(context);
    if (driver.status !== "ativo") throw new Error("Cadastro não está ativo");
    const open = await loadOpenShift(context.supabase, driver.id);
    if (open) return open;

    const { data, error } = await context.supabase
      .from("driver_shifts")
      .insert({
        driver_id: driver.id,
        restaurant_id: driver.restaurant_id,
        status: "ATIVO",
        current_state: "ONLINE",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const shift = data as ShiftRow;

    await insertTimeline(context.supabase, shift.id, "SHIFT_STARTED", null, "ONLINE", context.userId);

    // Entrar automaticamente na fila.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("queue_enqueue", {
        _restaurant_id: driver.restaurant_id,
        _driver_id: driver.id,
      });
      await applyTransition(context.supabase, shift, "AGUARDANDO", "QUEUE_ENTERED", context.userId);
    } catch {
      /* fila é best-effort no início do turno */
    }

    return shift;
  });

export const pauseShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const driver = await loadDriver(context);
    const shift = await loadOpenShift(context.supabase, driver.id);
    if (!shift) throw new Error("Nenhum turno ativo");
    if (shift.status === "PAUSADO") return shift;
    // Sai da fila ao pausar.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("queue_remove", {
        _restaurant_id: driver.restaurant_id,
        _driver_id: driver.id,
      });
    } catch { /* noop */ }
    return applyTransition(context.supabase, shift, "PAUSA", "PAUSE_STARTED", context.userId);
  });

export const resumeShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const driver = await loadDriver(context);
    const shift = await loadOpenShift(context.supabase, driver.id);
    if (!shift) throw new Error("Nenhum turno ativo");
    if (shift.status === "ATIVO") return shift;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("queue_enqueue", {
        _restaurant_id: driver.restaurant_id,
        _driver_id: driver.id,
      });
    } catch { /* noop */ }
    return applyTransition(context.supabase, shift, "AGUARDANDO", "PAUSE_FINISHED", context.userId);
  });

export const finishShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const driver = await loadDriver(context);
    const shift = await loadOpenShift(context.supabase, driver.id);
    if (!shift) throw new Error("Nenhum turno ativo");

    // Acumula tempo do estado atual antes de fechar.
    const closed = await applyTransition(
      context.supabase,
      shift,
      "OFFLINE",
      "SHIFT_FINISHED",
      context.userId,
    );

    const { data, error } = await context.supabase
      .from("driver_shifts")
      .update({ status: "FINALIZADO", finished_at: new Date().toISOString() })
      .eq("id", shift.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Sai da fila.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("queue_remove", {
        _restaurant_id: driver.restaurant_id,
        _driver_id: driver.id,
      });
    } catch { /* noop */ }

    return (data as ShiftRow) ?? closed;
  });

export const recordShiftEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => eventSchema.parse(d))
  .handler(async ({ context, data }) => {
    const driver = await loadDriver(context);
    const shift = await loadOpenShift(context.supabase, driver.id);
    if (!shift) return null;
    const next = EVENT_TO_STATE[data.event];
    return applyTransition(
      context.supabase,
      shift,
      next,
      data.event,
      context.userId,
      data.metadata ?? {},
      data.correlationId,
    );
  });

export const getCurrentShift = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const driver = await loadDriver(context);
    const shift = await loadOpenShift(context.supabase, driver.id);
    if (!shift) return null;
    // Devolve com acumulador em tempo real (não persiste).
    const acc = accumulate(
      {
        online_minutes: shift.online_minutes,
        waiting_minutes: shift.waiting_minutes,
        delivery_minutes: shift.delivery_minutes,
        return_minutes: shift.return_minutes,
        pause_minutes: shift.pause_minutes,
      },
      shift.current_state,
      shift.updated_at,
      new Date(),
    );
    return { ...shift, ...acc, live: true };
  });

export const listActiveShifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Restaurante vê seus próprios (RLS garante).
    const { data: restaurants } = await context.supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", context.userId)
      .limit(1);
    const rid = restaurants?.[0]?.id;
    if (!rid) return [];
    const { data } = await context.supabase
      .from("driver_shifts")
      .select("*, delivery_drivers(id, name, photo_url, vehicle_type)")
      .eq("restaurant_id", rid)
      .neq("status", "FINALIZADO")
      .order("started_at", { ascending: true });
    return (data ?? []) as unknown as (ShiftRow & { delivery_drivers: any })[];
  });

export const getShiftStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const driver = await loadDriver(context);
    const { data } = await context.supabase
      .from("driver_shifts")
      .select("id, started_at, finished_at, deliveries_count, earnings_total, distance_total_km, online_minutes, waiting_minutes, delivery_minutes, return_minutes, pause_minutes, status")
      .eq("driver_id", driver.id)
      .eq("status", "FINALIZADO")
      .order("started_at", { ascending: false })
      .limit(90);
    const rows = (data ?? []) as ShiftRow[];
    if (!rows.length) {
      return {
        biggestShiftMinutes: 0,
        biggestEarnings: 0,
        longestStreakDays: 0,
        avgShiftMinutes: 0,
        workedDays: 0,
        consecutiveDays: 0,
      };
    }
    const totals = rows.map((r) => {
      const total =
        r.online_minutes + r.waiting_minutes + r.delivery_minutes + r.return_minutes + r.pause_minutes;
      return { day: r.started_at.slice(0, 10), total, earnings: Number(r.earnings_total) };
    });
    const days = new Set(totals.map((t) => t.day));
    // sequência de dias consecutivos até hoje
    let consecutive = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) consecutive++;
      else if (i === 0) continue;
      else break;
    }
    // maior streak histórico
    const sorted = Array.from(days).sort();
    let longest = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const k of sorted) {
      const cur = new Date(k);
      if (prev && (cur.getTime() - prev.getTime()) / 86400000 === 1) run++;
      else run = 1;
      if (run > longest) longest = run;
      prev = cur;
    }
    return {
      biggestShiftMinutes: Math.max(...totals.map((t) => t.total)),
      biggestEarnings: Math.max(...totals.map((t) => t.earnings)),
      longestStreakDays: longest,
      avgShiftMinutes: totals.reduce((s, t) => s + t.total, 0) / totals.length,
      workedDays: days.size,
      consecutiveDays: consecutive,
    };
  });
