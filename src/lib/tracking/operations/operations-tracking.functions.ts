// Operations Tracking — server functions (read-only, RLS).
// Consome tracking_snapshots + orders + delivery_drivers + delivery_queue.
// Nunca escreve. Nunca chama outros domínios.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toSnapshot, toTimelineEntry } from "../tracking.mapper";
import type {
  OperationsActiveDelivery, OperationsDashboardData, OperationsDriverRow,
  OperationsQueueRow, OperationsDetail,
} from "./operations-tracking.types";
import { OperationsAlertService } from "./operations-alerts.service";
import { computeMetrics, computeQueueEta, computeTally } from "./operations-metrics";
import type { TrackingStatus, TrackingConfidence } from "../tracking.types";

const RestaurantIdInput = z.object({ restaurantId: z.string().uuid() });
const AssignmentIdInput = z.object({ assignmentId: z.string().uuid() });

const ACTIVE_STATES: TrackingStatus[] = [
  "AGUARDANDO", "ATRIBUIDO", "COLETANDO", "EM_ROTA",
  "PROXIMO_AO_DESTINO", "RETORNANDO", "RETORNO_NAO_CONFIRMADO", "SEM_SINAL",
];

export const getOperationsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RestaurantIdInput.parse(data))
  .handler(async ({ data, context }): Promise<OperationsDashboardData> => {
    const rid = data.restaurantId;
    const [snapsRes, driversRes, queueRes] = await Promise.all([
      context.supabase.from("tracking_snapshots").select("*").eq("restaurant_id", rid),
      context.supabase.from("delivery_drivers").select("id, name, online, status, last_seen_at").eq("restaurant_id", rid),
      context.supabase.from("delivery_queue").select("id, driver_id, position, status, entered_at")
        .eq("restaurant_id", rid).eq("status", "AGUARDANDO").order("position", { ascending: true }),
    ]);
    if (snapsRes.error) throw new Error(snapsRes.error.message);
    if (driversRes.error) throw new Error(driversRes.error.message);
    if (queueRes.error) throw new Error(queueRes.error.message);

    const snaps = (snapsRes.data ?? []).map((r) => toSnapshot(r as Record<string, unknown>));
    const drivers = (driversRes.data ?? []) as Array<{
      id: string; name: string; online: boolean;
      status: string; last_seen_at: string | null;
    }>;
    const queueRows = (queueRes.data ?? []) as Array<{
      id: string; driver_id: string; position: number; status: string; entered_at: string;
    }>;

    // Buscar order_number + customer_name para pedidos ativos
    const activeSnaps = snaps.filter((s) => ACTIVE_STATES.includes(s.status));
    const orderIds = Array.from(new Set(activeSnaps.map((s) => s.order_id)));
    let orderMap = new Map<string, { order_number: number | null; customer_name: string; address: string | null }>();
    if (orderIds.length) {
      const { data: orders, error: ordersErr } = await context.supabase
        .from("orders").select("id, order_number, customer_name, address").in("id", orderIds);
      if (ordersErr) throw new Error(ordersErr.message);
      orderMap = new Map((orders ?? []).map((o) => [o.id as string, {
        order_number: o.order_number as number | null,
        customer_name: o.customer_name as string,
        address: (o.address as string | null) ?? null,
      }]));
    }

    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    const now = Date.now();

    const active: OperationsActiveDelivery[] = activeSnaps.map((s) => {
      const o = orderMap.get(s.order_id);
      const d = driverMap.get(s.driver_id);
      const started = new Date(s.created_at).getTime();
      const minutes = Math.max(0, Math.floor((now - started) / 60000));
      return {
        assignment_id: s.assignment_id, order_id: s.order_id,
        order_number: o?.order_number ?? null,
        customer_name: o?.customer_name ?? "—",
        neighborhood: extractNeighborhood(o?.address ?? null),
        driver_id: s.driver_id, driver_name: d?.name ?? "—",
        status: s.status, eta_seconds: s.eta_seconds, confidence: s.confidence as TrackingConfidence,
        last_seen_at: s.last_seen_at, started_at: s.created_at,
        minutes_since_start: minutes, is_delayed: minutes >= 30,
      };
    });

    const driverRows: OperationsDriverRow[] = drivers.map((d) => {
      const snap = activeSnaps.find((s) => s.driver_id === d.id);
      let state: OperationsDriverRow["state"] = d.online ? "AGUARDANDO" : "OFFLINE";
      if (!d.online) state = "OFFLINE";
      else if (snap?.status === "RETORNANDO" || snap?.status === "RETORNO_NAO_CONFIRMADO") state = "RETORNANDO";
      else if (snap && snap.status !== "AGUARDANDO") state = "EM_ENTREGA";
      else if (d.status === "afastado") state = "PAUSA";
      return {
        driver_id: d.id, name: d.name, state, online: d.online,
        online_since: d.last_seen_at, current_order_id: snap?.order_id ?? null,
        current_order_number: snap ? orderMap.get(snap.order_id)?.order_number ?? null : null,
        eta_return_seconds: snap && state === "RETORNANDO" ? snap.eta_seconds : null,
        last_seen_at: d.last_seen_at,
      };
    });

    const queue: OperationsQueueRow[] = queueRows.map((q) => {
      const dr = driverMap.get(q.driver_id);
      const wait = Math.max(0, Math.floor((now - new Date(q.entered_at).getTime()) / 60000));
      return {
        position: q.position, driver_id: q.driver_id,
        driver_name: dr?.name ?? "—", waiting_since: q.entered_at,
        waiting_minutes: wait, eta_available_seconds: null,
      };
    });

    const metrics = computeMetrics(active);
    const queueWithEta = computeQueueEta(queue, metrics.avg_delivery_minutes);
    const alerts = OperationsAlertService.build(active, driverRows, queueWithEta);
    const tally = computeTally(driverRows);

    return { active, drivers: driverRows, queue: queueWithEta, alerts, metrics, tally };
  });

export const getOperationsDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => AssignmentIdInput.parse(data))
  .handler(async ({ data, context }): Promise<OperationsDetail | null> => {
    const [snapRes, tlRes] = await Promise.all([
      context.supabase.from("tracking_snapshots").select("*").eq("assignment_id", data.assignmentId).maybeSingle(),
      context.supabase.from("tracking_timeline").select("*").eq("assignment_id", data.assignmentId)
        .order("created_at", { ascending: true }),
    ]);
    if (snapRes.error) throw new Error(snapRes.error.message);
    if (tlRes.error) throw new Error(tlRes.error.message);
    if (!snapRes.data) return null;
    return {
      snapshot: toSnapshot(snapRes.data as Record<string, unknown>),
      timeline: (tlRes.data ?? []).map((r) => toTimelineEntry(r as Record<string, unknown>)),
    };
  });

function extractNeighborhood(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[1] ?? null;
}
