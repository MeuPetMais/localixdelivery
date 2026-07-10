// RC5.2.f — Driver Shift State Machine.
// Estados operacionais internos do turno do motoboy.

export const SHIFT_STATUSES = ["ATIVO", "PAUSADO", "FINALIZADO"] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export const SHIFT_STATES = [
  "ONLINE",
  "AGUARDANDO",
  "EM_ENTREGA",
  "RETORNANDO",
  "PAUSA",
  "OFFLINE",
] as const;
export type ShiftCurrentState = (typeof SHIFT_STATES)[number];

export const SHIFT_EVENTS = [
  "SHIFT_STARTED",
  "QUEUE_ENTERED",
  "DELIVERY_ASSIGNED",
  "DELIVERY_COLLECTED",
  "DELIVERY_STARTED",
  "DELIVERY_FINISHED",
  "RETURN_STARTED",
  "RETURN_FINISHED",
  "PAUSE_STARTED",
  "PAUSE_FINISHED",
  "SHIFT_FINISHED",
] as const;
export type ShiftEvent = (typeof SHIFT_EVENTS)[number];

// Mapa de eventos → próximo estado operacional.
export const EVENT_TO_STATE: Record<ShiftEvent, ShiftCurrentState> = {
  SHIFT_STARTED: "ONLINE",
  QUEUE_ENTERED: "AGUARDANDO",
  DELIVERY_ASSIGNED: "EM_ENTREGA",
  DELIVERY_COLLECTED: "EM_ENTREGA",
  DELIVERY_STARTED: "EM_ENTREGA",
  DELIVERY_FINISHED: "RETORNANDO",
  RETURN_STARTED: "RETORNANDO",
  RETURN_FINISHED: "AGUARDANDO",
  PAUSE_STARTED: "PAUSA",
  PAUSE_FINISHED: "AGUARDANDO",
  SHIFT_FINISHED: "OFFLINE",
};

export function isTerminalStatus(s: ShiftStatus): boolean {
  return s === "FINALIZADO";
}
