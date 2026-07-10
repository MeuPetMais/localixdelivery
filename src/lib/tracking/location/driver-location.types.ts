// Driver Location — Types (RC5.3.b).
// Representa APENAS coordenadas físicas do motoboy. Sem estado operacional.

export type DriverLocationConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface DriverLocationSample {
  driver_id: string;
  assignment_id?: string | null;
  restaurant_id?: string | null;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;      // m/s
  accuracy?: number | null;   // meters
  captured_at: string;        // ISO
  correlation_id?: string;
  source?: "gps" | "manual" | "sync";
}

export interface DriverLocationEvaluation {
  sample: DriverLocationSample;
  confidence: DriverLocationConfidence;
  reasons: string[];
  spoof_score: number; // 0..100
  significant_change: boolean;
}

export interface DriverLocationConfig {
  min_move_meters: number;         // gate para "significant change"
  max_speed_ms: number;             // 120 km/h ≈ 33 m/s
  max_teleport_meters_per_sec: number;
  min_accuracy_m: number;           // se > n, LOW
  stale_seconds: number;            // se sample mais antigo, LOW
}

export const DEFAULT_LOCATION_CONFIG: DriverLocationConfig = {
  min_move_meters: 15,
  max_speed_ms: 33,
  max_teleport_meters_per_sec: 45,
  min_accuracy_m: 100,
  stale_seconds: 120,
};
