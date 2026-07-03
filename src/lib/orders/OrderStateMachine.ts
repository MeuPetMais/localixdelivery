// State Machine central de pedidos do Localix.
// Regra: nenhum módulo pode alterar status diretamente. Toda transição passa
// pelo OrderOrchestrator, que consulta este arquivo para validar.

export type OrderState =
  | "CREATED"
  | "WAITING_PAYMENT"
  | "PAYMENT_APPROVED"
  | "PAYMENT_FAILED"
  | "RESTAURANT_ACCEPTED"
  | "RESTAURANT_REJECTED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "CHARGEBACK";

export const ORDER_STATES: OrderState[] = [
  "CREATED",
  "WAITING_PAYMENT",
  "PAYMENT_APPROVED",
  "PAYMENT_FAILED",
  "RESTAURANT_ACCEPTED",
  "RESTAURANT_REJECTED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "CHARGEBACK",
];

// Estados terminais: nenhuma transição de saída permitida.
export const TERMINAL_STATES: OrderState[] = [
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "CHARGEBACK",
  "RESTAURANT_REJECTED",
];

// Mapa de transições permitidas. Qualquer transição fora deste mapa é inválida.
export const ALLOWED_TRANSITIONS: Record<OrderState, OrderState[]> = {
  CREATED: ["WAITING_PAYMENT", "CANCELLED"],
  WAITING_PAYMENT: ["PAYMENT_APPROVED", "PAYMENT_FAILED", "CANCELLED"],
  PAYMENT_APPROVED: ["RESTAURANT_ACCEPTED", "RESTAURANT_REJECTED", "REFUNDED", "CHARGEBACK", "CANCELLED"],
  PAYMENT_FAILED: ["WAITING_PAYMENT", "CANCELLED"],
  RESTAURANT_ACCEPTED: ["PREPARING", "CANCELLED", "REFUNDED"],
  RESTAURANT_REJECTED: [],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "REFUNDED", "CHARGEBACK"],
  COMPLETED: ["REFUNDED", "CHARGEBACK"],
  CANCELLED: [],
  REFUNDED: [],
  CHARGEBACK: [],
};

export function isTerminal(state: OrderState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function canTransition(from: OrderState, to: OrderState): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}
