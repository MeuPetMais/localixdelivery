// Tracking Domain — Server functions (RC5.3.a).
// Leituras autenticadas via RLS (o requester enxerga apenas o que pode).
// Escritas ficam a cargo do servidor com service role em futuras integrações;
// aqui expomos apenas `upsert` protegido para uso interno assinado (Order Domain
// / Delivery Assignment) — a permissão real é reforçada por RLS + role check.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toSnapshot, toTimelineEntry } from "./tracking.mapper";

const AssignmentIdInput = z.object({ assignmentId: z.string().uuid() });
const OrderIdInput = z.object({ orderId: z.string().uuid() });

export const getTrackingSnapshotByAssignment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => AssignmentIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tracking_snapshots")
      .select("*")
      .eq("assignment_id", data.assignmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? toSnapshot(row as Record<string, unknown>) : null;
  });

export const getTrackingSnapshotByOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => OrderIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tracking_snapshots")
      .select("*")
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? toSnapshot(row as Record<string, unknown>) : null;
  });

export const listTrackingTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => AssignmentIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tracking_timeline")
      .select("*")
      .eq("assignment_id", data.assignmentId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => toTimelineEntry(r as Record<string, unknown>));
  });
