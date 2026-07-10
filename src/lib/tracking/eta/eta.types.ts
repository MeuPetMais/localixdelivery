// ETA Engine — Types (RC5.3.c).
// Fonte oficial de tempo estimado APÓS DeliveryAssigned. Antes, ETA pertence a Delivery.

export type EtaConfidence = "HIGH" | "MEDIUM" | "LOW";

export type EtaAlgorithm = "distance" | "traffic" | "historical" | "ai";

export interface EtaInput {
  assignment_id: string;
  restaurant_id: string;
  order_id: string;
  driver_id: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  destination_lat: number;
  destination_lng: number;
  speed_ms?: number | null;         // velocidade atual (m/s)
  heading?: number | null;
  status: string;                    // status do tracking
  last_seen_at?: string | null;      // ISO
  location_confidence?: EtaConfidence;
  now?: string;                      // ISO, para testes
  correlation_id?: string;
}

export interface EtaWindow {
  min_seconds: number;
  max_seconds: number;
}

export interface EtaResult {
  eta_seconds: number;
  eta_minutes: number;
  window: EtaWindow;
  confidence: EtaConfidence;
  algorithm: EtaAlgorithm;
  distance_km: number;
  reasons: string[];
  updated_at: string;
}

export interface EtaHistoryRecord {
  id: string;
  assignment_id: string;
  restaurant_id: string;
  order_id: string;
  driver_id: string | null;
  predicted_eta_seconds: number;
  actual_eta_seconds: number | null;
  difference_seconds: number | null;
  confidence: EtaConfidence;
  algorithm: EtaAlgorithm;
  window_min_seconds: number | null;
  window_max_seconds: number | null;
  correlation_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EtaEngineConfig {
  default_speed_ms: number;         // usado quando não há velocidade recente
  min_speed_ms: number;              // piso para evitar divisão por zero
  stale_seconds: number;             // acima disto → LOW
  significant_change_seconds: number;// gate de recomputo/publicação (default 30s)
  min_window_ratio: number;          // % para janela inferior (ex 0.85)
  max_window_ratio: number;          // % para janela superior (ex 1.20)
  low_confidence_window_bump: number;// segundos extra na janela quando LOW
}

export const DEFAULT_ETA_CONFIG: EtaEngineConfig = {
  default_speed_ms: 7,               // ~25 km/h
  min_speed_ms: 2,
  stale_seconds: 90,
  significant_change_seconds: 30,
  min_window_ratio: 0.85,
  max_window_ratio: 1.2,
  low_confidence_window_bump: 60,
};
