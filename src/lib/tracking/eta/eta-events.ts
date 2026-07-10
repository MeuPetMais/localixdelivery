// ETA Events — event bus em processo.

import type { EtaConfidence, EtaResult } from "./eta.types";

export type EtaEventType =
  | "EtaCalculated"
  | "EtaChanged"
  | "EtaPublished"
  | "EtaSkipped";

export interface EtaEventPayload {
  type: EtaEventType;
  assignment_id: string;
  restaurant_id: string;
  order_id: string;
  driver_id: string | null;
  eta_seconds: number;
  previous_eta_seconds: number | null;
  confidence: EtaConfidence;
  algorithm: string;
  correlation_id?: string;
  at: string;
  meta?: Record<string, unknown>;
}

type Listener = (evt: EtaEventPayload) => void;
const listeners = new Set<Listener>();

export function onEtaEvent(l: Listener): () => void {
  listeners.add(l); return () => { listeners.delete(l); };
}

export function emitEtaEvent(evt: EtaEventPayload): void {
  for (const l of listeners) { try { l(evt); } catch (e) { console.error("[eta-events]", e); } }
}

export function buildEtaEvent(
  type: EtaEventType,
  base: {
    assignment_id: string; restaurant_id: string; order_id: string; driver_id: string | null;
    result: EtaResult; previous_eta_seconds: number | null; correlation_id?: string;
  },
  meta?: Record<string, unknown>,
): EtaEventPayload {
  return {
    type,
    assignment_id: base.assignment_id,
    restaurant_id: base.restaurant_id,
    order_id: base.order_id,
    driver_id: base.driver_id,
    eta_seconds: base.result.eta_seconds,
    previous_eta_seconds: base.previous_eta_seconds,
    confidence: base.result.confidence,
    algorithm: base.result.algorithm,
    correlation_id: base.correlation_id,
    at: base.result.updated_at,
    meta,
  };
}
