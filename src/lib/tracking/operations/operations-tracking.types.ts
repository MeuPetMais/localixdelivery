// Operations Tracking — Types (RC5.3.e).
// Visão operacional agregada consumida pelo restaurante. Apenas leitura;
// nunca muta Orders/Delivery/Tracking. Sem dados financeiros/wallet/ranking.

import type { TrackingSnapshot, TrackingTimelineEntry, TrackingStatus, TrackingConfidence } from "../tracking.types";

export type OperationsDriverState =
  | "AGUARDANDO" | "EM_ENTREGA" | "RETORNANDO" | "PAUSA" | "OFFLINE";

export interface OperationsDriverRow {
  driver_id: string;
  name: string;
  state: OperationsDriverState;
  online: boolean;
  online_since: string | null;
  current_order_id: string | null;
  current_order_number: number | null;
  eta_return_seconds: number | null;
  last_seen_at: string | null;
}

export interface OperationsQueueRow {
  position: number;
  driver_id: string;
  driver_name: string;
  waiting_since: string;
  waiting_minutes: number;
  eta_available_seconds: number | null;
}

export interface OperationsActiveDelivery {
  assignment_id: string;
  order_id: string;
  order_number: number | null;
  customer_name: string;
  neighborhood: string | null;
  driver_id: string;
  driver_name: string;
  status: TrackingStatus;
  eta_seconds: number | null;
  confidence: TrackingConfidence;
  last_lat: number | null;
  last_lng: number | null;
  last_accuracy: number | null;
  last_seen_at: string | null;
  started_at: string;
  minutes_since_start: number;
  is_delayed: boolean;
}

export type OperationsAlertKind =
  | "ORDER_STUCK"
  | "HEARTBEAT_LOST"
  | "ETA_LOW_CONFIDENCE"
  | "DRIVER_OFFLINE"
  | "NO_MOVEMENT"
  | "QUEUE_EMPTY";

export interface OperationsAlert {
  id: string;
  kind: OperationsAlertKind;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  ref_order_id?: string;
  ref_driver_id?: string;
  at: string;
}

export interface OperationsMetrics {
  active_deliveries: number;
  avg_eta_seconds: number | null;
  max_delay_minutes: number;
  avg_delivery_minutes: number | null;
  avg_return_minutes: number | null;
  avg_wait_minutes: number | null;
  success_rate: number | null;
  eta_accuracy: number | null;
  avg_confidence: TrackingConfidence;
}

export interface OperationsDrivertally {
  disponivel: number;
  em_entrega: number;
  retornando: number;
  pausado: number;
  offline: number;
}

export interface OperationsDashboardData {
  active: OperationsActiveDelivery[];
  drivers: OperationsDriverRow[];
  queue: OperationsQueueRow[];
  alerts: OperationsAlert[];
  metrics: OperationsMetrics;
  tally: OperationsDrivertally;
}

export interface OperationsDetail {
  snapshot: TrackingSnapshot;
  timeline: TrackingTimelineEntry[];
  restaurant: { name: string | null; address: string | null; lat: number | null; lng: number | null } | null;
  order: { address: string | null; order_number: number | null } | null;
}

export interface OperationsFilters {
  status?: TrackingStatus[];
  driverId?: string;
  neighborhood?: string;
  search?: string;
  since?: string;
  until?: string;
}
