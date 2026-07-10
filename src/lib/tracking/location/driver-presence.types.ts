// Driver Presence — Types (RC5.3.b).
// Presence NUNCA contém GPS. Apenas estado operacional do motoboy.

export type DriverPresenceState =
  | "ONLINE"
  | "OFFLINE"
  | "AGUARDANDO"
  | "EM_ENTREGA"
  | "RETORNANDO"
  | "PAUSA";

export interface DriverPresence {
  driver_id: string;
  restaurant_id: string | null;
  state: DriverPresenceState;
  updated_at: string;
  heartbeat_interval_ms: number;
}

// Intervalos de heartbeat adaptativos (RFC RC5.3 §11).
export interface HeartbeatIntervals {
  AGUARDANDO: number;
  EM_ENTREGA: number;
  PROXIMO_DESTINO: number;
  RETORNANDO: number;
  ONLINE: number;
  OFFLINE: number;
  PAUSA: number;
}

export const DEFAULT_HEARTBEAT_INTERVALS: HeartbeatIntervals = {
  AGUARDANDO: 30_000,
  EM_ENTREGA: 5_000,
  PROXIMO_DESTINO: 2_000,
  RETORNANDO: 10_000,
  ONLINE: 30_000,
  OFFLINE: 0,
  PAUSA: 60_000,
};
