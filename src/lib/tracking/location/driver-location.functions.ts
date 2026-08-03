// Driver Location server functions.
// Persists only current operational position and active-delivery snapshot.
// Coordinates are never written to application logs.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LocationSampleSchema = z.object({
  driver_id: z.string().uuid(),
  assignment_id: z.string().uuid().optional().nullable(),
  restaurant_id: z.string().uuid().optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  captured_at: z.string(),
  correlation_id: z.string().uuid().optional(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
});

const IngestInput = z.object({
  samples: z.array(LocationSampleSchema).min(1).max(50),
});

export const ingestDriverLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => IngestInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let accepted = 0;
    let skipped = 0;
    const reasons: Record<string, number> = {};

    for (const sample of data.samples) {
      if (!sample.restaurant_id) {
        skipped++;
        reasons.MISSING_RESTAURANT = (reasons.MISSING_RESTAURANT ?? 0) + 1;
        continue;
      }

      const { data: result, error } = await supabaseAdmin.rpc("upsert_driver_operational_location" as never, {
        _driver_id: sample.driver_id,
        _restaurant_id: sample.restaurant_id,
        _assignment_id: sample.assignment_id ?? null,
        _lat: sample.lat,
        _lng: sample.lng,
        _accuracy: sample.accuracy ?? null,
        _heading: sample.heading ?? null,
        _speed: sample.speed ?? null,
        _device_captured_at: sample.captured_at,
        _correlation_id: sample.correlation_id ?? crypto.randomUUID(),
      } as never);

      if (error) {
        skipped++;
        reasons.RPC_ERROR = (reasons.RPC_ERROR ?? 0) + 1;
        continue;
      }

      const payload = result as unknown as { ok?: boolean; reason?: string } | null;
      if (payload?.ok) {
        accepted++;
      } else {
        skipped++;
        const reason = payload?.reason ?? "UNKNOWN";
        reasons[reason] = (reasons[reason] ?? 0) + 1;
      }
    }

    return { accepted, skipped, reasons };
  });
