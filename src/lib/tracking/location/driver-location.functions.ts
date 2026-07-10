// Driver Location — Server functions (RC5.3.b).
// Persistem apenas ÚLTIMA POSIÇÃO + CONFIDENCE no tracking_snapshots.
// Nunca gravam histórico coordenada-a-coordenada (contra manifesto).
// RLS reforça: motoboy só escreve o próprio driver_id.

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
  correlation_id: z.string().optional(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
});

const IngestInput = z.object({
  samples: z.array(LocationSampleSchema).min(1).max(50),
});

export const ingestDriverLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => IngestInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let accepted = 0;
    let skipped = 0;

    for (const s of data.samples) {
      // Só permite o próprio driver_id (RLS reforça também).
      if (s.driver_id !== userId) { skipped++; continue; }
      if (!s.assignment_id) { skipped++; continue; }

      const { error } = await supabase
        .from("tracking_snapshots")
        .update({
          last_lat: s.lat,
          last_lng: s.lng,
          last_heading: s.heading ?? null,
          last_speed: s.speed ?? null,
          last_seen_at: s.captured_at,
          confidence: s.confidence ?? "MEDIUM",
        })
        .eq("assignment_id", s.assignment_id)
        .eq("driver_id", s.driver_id);
      if (error) { console.error("[ingestDriverLocations]", error.message); skipped++; }
      else accepted++;
    }
    return { accepted, skipped };
  });
