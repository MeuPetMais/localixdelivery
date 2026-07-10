// ETA — Server functions (RC5.3.c).
// Atualiza APENAS eta_seconds + confidence + metadata.window no tracking_snapshots.
// Nunca cria snapshot novo. Nunca muta Orders/Delivery.
// Persiste histórico em tracking_eta_history.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RecalcInput = z.object({
  assignment_id: z.string().uuid(),
  destination_lat: z.number().min(-90).max(90),
  destination_lng: z.number().min(-180).max(180),
  speed_ms: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  correlation_id: z.string().optional(),
});

export const recalcEtaForAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RecalcInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: snap, error: snapErr } = await supabase
      .from("tracking_snapshots")
      .select("assignment_id, restaurant_id, order_id, driver_id, last_lat, last_lng, last_seen_at, confidence, status, metadata, eta_seconds")
      .eq("assignment_id", data.assignment_id)
      .maybeSingle();
    if (snapErr || !snap) return { ok: false, reason: "SNAPSHOT_NOT_FOUND" };

    const { createEtaEngine } = await import("./eta-engine.service");
    const engine = createEtaEngine();
    const { result, changed, previous_eta_seconds } = engine.calculate({
      assignment_id: snap.assignment_id as string,
      restaurant_id: snap.restaurant_id as string,
      order_id: snap.order_id as string,
      driver_id: (snap.driver_id as string) ?? null,
      driver_lat: (snap.last_lat as number) ?? null,
      driver_lng: (snap.last_lng as number) ?? null,
      destination_lat: data.destination_lat,
      destination_lng: data.destination_lng,
      speed_ms: data.speed_ms ?? null,
      heading: data.heading ?? null,
      status: (snap.status as string) ?? "AGUARDANDO",
      last_seen_at: (snap.last_seen_at as string) ?? null,
      location_confidence: (snap.confidence as "HIGH" | "MEDIUM" | "LOW") ?? "MEDIUM",
      correlation_id: data.correlation_id,
    });

    if (!changed) return { ok: true, changed: false, eta_seconds: result.eta_seconds };

    const meta = { ...(snap.metadata as Record<string, unknown> ?? {}),
      eta_window: { min_seconds: result.window.min_seconds, max_seconds: result.window.max_seconds },
      eta_algorithm: result.algorithm,
      eta_updated_at: result.updated_at,
    };

    const { error: upErr } = await supabase
      .from("tracking_snapshots")
      .update({ eta_seconds: result.eta_seconds, metadata: meta })
      .eq("assignment_id", data.assignment_id);
    if (upErr) return { ok: false, reason: upErr.message };

    const { error: histErr } = await supabase.from("tracking_eta_history").insert({
      assignment_id: snap.assignment_id,
      restaurant_id: snap.restaurant_id,
      order_id: snap.order_id,
      driver_id: snap.driver_id,
      predicted_eta_seconds: result.eta_seconds,
      confidence: result.confidence,
      algorithm: result.algorithm,
      window_min_seconds: result.window.min_seconds,
      window_max_seconds: result.window.max_seconds,
      correlation_id: data.correlation_id ?? null,
      metadata: { reasons: result.reasons, distance_km: result.distance_km, previous_eta_seconds },
    });
    if (histErr) console.error("[recalcEtaForAssignment] history", histErr.message);

    return { ok: true, changed: true, eta_seconds: result.eta_seconds, confidence: result.confidence, window: result.window };
  });

const HistoryInput = z.object({ assignment_id: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() });

export const listEtaHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => HistoryInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("tracking_eta_history")
      .select("*")
      .eq("assignment_id", data.assignment_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) return { ok: false, reason: error.message, rows: [] as any[] };
    return { ok: true, rows: rows ?? [] };
  });
