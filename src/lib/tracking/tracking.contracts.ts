// Tracking Domain — Contratos públicos.
// Interfaces expostas a outros domínios / camada de apresentação.

import type {
  TrackingSnapshot, TrackingTimelineEntry, TrackingStatus, TrackingConfidence,
} from "./tracking.types";

export type { TrackingSnapshot, TrackingTimelineEntry, TrackingStatus, TrackingConfidence };

// Payload de Realtime enviado para clientes/motoboys/restaurantes.
// Nunca inclui coordenadas cruas para o cliente final (§17 RFC).
export interface TrackingRealtimePayload {
  assignment_id: string;
  order_id: string;
  status: TrackingStatus;
  eta_seconds: number | null;
  confidence: TrackingConfidence;
  updated_at: string;
}

export interface TrackingEvent {
  type: string;
  correlation_id: string;
  assignment_id: string;
  restaurant_id: string;
  order_id: string;
  driver_id: string | null;
  at: string;
}
