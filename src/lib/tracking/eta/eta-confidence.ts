// ETA Confidence — deriva HIGH/MEDIUM/LOW a partir de sinais.

import type { EtaConfidence, EtaEngineConfig, EtaInput } from "./eta.types";

export function evaluateEtaConfidence(
  input: EtaInput, config: EtaEngineConfig, nowIso?: string,
): { confidence: EtaConfidence; reasons: string[] } {
  const reasons: string[] = [];
  let score = 100;

  if (input.driver_lat == null || input.driver_lng == null) {
    return { confidence: "LOW", reasons: ["no_gps"] };
  }

  const now = new Date(nowIso ?? input.now ?? new Date().toISOString()).getTime();
  if (input.last_seen_at) {
    const age = (now - new Date(input.last_seen_at).getTime()) / 1000;
    if (age > config.stale_seconds * 2) { score -= 60; reasons.push("very_stale"); }
    else if (age > config.stale_seconds) { score -= 35; reasons.push("stale"); }
  } else {
    score -= 20; reasons.push("no_last_seen");
  }

  if (input.location_confidence === "LOW") { score -= 30; reasons.push("gps_low"); }
  else if (input.location_confidence === "MEDIUM") { score -= 10; reasons.push("gps_medium"); }

  if (input.speed_ms != null && input.speed_ms <= 0.2) { score -= 10; reasons.push("no_motion"); }

  const conf: EtaConfidence = score >= 75 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";
  return { confidence: conf, reasons };
}
