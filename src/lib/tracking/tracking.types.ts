// Tracking Domain — Types
// RC5.3.a Tracking Core. Alinhado a docs/DOMAIN_MANIFEST_TRACKING.md.
// Tracking apenas observa/calcula/publica; nunca muta Orders/Delivery/Driver.

export type TrackingStatus =
  | "AGUARDANDO"
  | "ATRIBUIDO"
  | "COLETANDO"
  | "EM_ROTA"
  | "PROXIMO_AO_DESTINO"
  | "ENTREGUE"
  | "RETORNANDO"
  | "RETORNO_NAO_CONFIRMADO"
  | "SEM_SINAL"
  | "CANCELADO";

export type TrackingConfidence = "HIGH" | "MEDIUM" | "LOW";

export type TrackingActor = "system" | "restaurant" | "driver" | "customer" | "admin";

export interface TrackingSnapshot {
  id: string;
  assignment_id: string;
  driver_id: string;
  restaurant_id: string;
  order_id: string;
  status: TrackingStatus;
  eta_seconds: number | null;
  confidence: TrackingConfidence;
  last_lat: number | null;
  last_lng: number | null;
  last_speed: number | null;
  last_heading: number | null;
  last_seen_at: string | null;
  metadata: Record<string, unknown>;
  correlation_id: string;
  created_at: string;
  updated_at: string;
}

export interface TrackingTimelineEntry {
  id: string;
  assignment_id: string;
  restaurant_id: string;
  order_id: string;
  driver_id: string | null;
  event: string;
  previous_status: TrackingStatus | null;
  current_status: TrackingStatus | null;
  actor: TrackingActor;
  metadata: Record<string, unknown>;
  correlation_id: string;
  created_at: string;
}

export interface TrackingSnapshotInput {
  assignment_id: string;
  driver_id: string;
  restaurant_id: string;
  order_id: string;
  status: TrackingStatus;
  eta_seconds?: number | null;
  confidence?: TrackingConfidence;
  correlation_id?: string;
  metadata?: Record<string, unknown>;
}

export interface TrackingSnapshotPatch {
  status?: TrackingStatus;
  eta_seconds?: number | null;
  confidence?: TrackingConfidence;
  last_lat?: number | null;
  last_lng?: number | null;
  last_speed?: number | null;
  last_heading?: number | null;
  last_seen_at?: string | null;
  metadata?: Record<string, unknown>;
}
