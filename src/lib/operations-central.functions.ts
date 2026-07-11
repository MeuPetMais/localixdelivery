// RC7.0 — Central Operacional: agregador read-only para o painel do restaurante.
// Não altera Orders/Payments/Delivery/Tracking/Queue/Wallet — apenas lê.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  classifyDriver, returnGapsMinutes, averageMinutes,
  type CentralGroup,
} from "./operations-central";

export type { CentralGroup } from "./operations-central";

async function assertOwner(supabase: any, userId: string, restaurantId: string) {
  const { data } = await supabase
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!data || data.owner_id !== userId) {
    throw new Error("Sem permissão para este restaurante");
  }
}

type DriverRow = {
  id: string; name: string; phone: string | null; photo_url: string | null;
  vehicle_type: string; vehicle_plate: string | null;
  status: string; online: boolean;
  last_seen_at: string | null;
};



export type CentralDriver = DriverRow & {
  group: CentralGroup;
  queue_position: number | null;
  active_order_number: number | null;
  active_customer: string | null;
  active_since: string | null; // assigned_at
};

export type CentralMetrics = {
  avgTotalMinutes: number | null;   // média por entrega (atribuído → entregue)
  avgReturnMinutes: number | null;  // média entregue → próxima atribuição
  queueLength: number;
  delivering: number;
  returning: number;
  paused: number;
  offline: number;
  total: number;
};

export const getOperationsCentral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId, data.restaurantId);
    const sb = context.supabase;
    const rid = data.restaurantId;

    const [{ data: drivers }, { data: queueRows }, { data: assigns }] = await Promise.all([
      sb.from("delivery_drivers")
        .select("id, name, phone, photo_url, vehicle_type, vehicle_plate, status, online, last_seen_at")
        .eq("restaurant_id", rid),
      sb.from("delivery_queue")
        .select("driver_id, position, status, entered_at")
        .eq("restaurant_id", rid)
        .in("status", ["AGUARDANDO", "RETORNANDO", "EM_ENTREGA"]),
      sb.from("delivery_assignments")
        .select("id, driver_id, order_id, status, assigned_at, delivered_at")
        .eq("restaurant_id", rid)
        .gte("assigned_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order("assigned_at", { ascending: false }),
    ]);

    const dl = (drivers ?? []) as DriverRow[];
    const ql = (queueRows ?? []) as { driver_id: string; position: number; status: string; entered_at: string }[];
    const al = (assigns ?? []) as {
      id: string; driver_id: string | null; order_id: string | null;
      status: string; assigned_at: string | null; delivered_at: string | null;
    }[];

    // Load related orders for customer/order_number
    const orderIds = Array.from(new Set(al.map((a) => a.order_id).filter(Boolean))) as string[];
    let orders: Record<string, { order_number: number; customer_name: string | null }> = {};
    if (orderIds.length > 0) {
      const { data: os } = await sb
        .from("orders")
        .select("id, order_number, customer_name")
        .in("id", orderIds);
      for (const o of (os ?? []) as any[]) {
        orders[o.id] = { order_number: o.order_number, customer_name: o.customer_name };
      }
    }

    const activeByDriver = new Map<string, typeof al[number]>();
    for (const a of al) {
      if (!a.driver_id) continue;
      if (!["ATRIBUIDO", "COLETANDO", "EM_ROTA"].includes(a.status)) continue;
      if (!activeByDriver.has(a.driver_id)) activeByDriver.set(a.driver_id, a);
    }

    const queueByDriver = new Map<string, typeof ql[number]>();
    for (const q of ql) queueByDriver.set(q.driver_id, q);

    const enriched: CentralDriver[] = dl.map((d) => {
      const q = queueByDriver.get(d.id);
      const a = activeByDriver.get(d.id);
      const order = a?.order_id ? orders[a.order_id] : undefined;
      const group = classifyDriver(d, q, a);
      return {
        ...d,
        group,
        queue_position: q?.status === "AGUARDANDO" ? q.position : null,
        active_order_number: order?.order_number ?? null,
        active_customer: order?.customer_name ?? null,
        active_since: a?.assigned_at ?? null,
      };
    });

    // Tempo médio por entrega (últimas 50 entregas)
    const delivered = al
      .filter((a) => a.status === "ENTREGUE" && a.assigned_at && a.delivered_at)
      .slice(0, 50);
    const totalDeltas = delivered.map(
      (a) => Math.max(0, (new Date(a.delivered_at!).getTime() - new Date(a.assigned_at!).getTime()) / 60000),
    );
    const avgTotalMinutes = averageMinutes(totalDeltas);
    const avgReturnMinutes = averageMinutes(returnGapsMinutes(al));

    const counts = enriched.reduce(
      (acc, d) => { acc[d.group] = (acc[d.group] ?? 0) + 1; return acc; },
      {} as Record<CentralGroup, number>,
    );

    const metrics: CentralMetrics = {
      avgTotalMinutes,
      avgReturnMinutes,
      queueLength: counts.fila ?? 0,
      delivering: counts.em_entrega ?? 0,
      returning: counts.retornando ?? 0,
      paused: counts.pausa ?? 0,
      offline: counts.offline ?? 0,
      total: enriched.length,
    };

    // Sort inside each group: fila by position asc, others by name
    enriched.sort((a, b) => {
      if (a.group === "fila" && b.group === "fila") {
        return (a.queue_position ?? 999) - (b.queue_position ?? 999);
      }
      return a.name.localeCompare(b.name);
    });

    return { drivers: enriched, metrics };
  });
