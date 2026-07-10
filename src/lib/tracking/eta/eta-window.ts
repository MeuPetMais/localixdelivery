// ETA Window — gera intervalo estimado. Nunca valor único.

import type { EtaConfidence, EtaEngineConfig, EtaWindow } from "./eta.types";

export function buildEtaWindow(
  etaSeconds: number, confidence: EtaConfidence, config: EtaEngineConfig,
): EtaWindow {
  const min = Math.max(30, Math.round(etaSeconds * config.min_window_ratio));
  let max = Math.max(min + 60, Math.round(etaSeconds * config.max_window_ratio));
  if (confidence === "LOW") max += config.low_confidence_window_bump;
  else if (confidence === "MEDIUM") max += Math.round(config.low_confidence_window_bump / 2);
  return { min_seconds: min, max_seconds: max };
}
