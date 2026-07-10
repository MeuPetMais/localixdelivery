// RC5.2.a.2 — State machine oficial do Delivery Assignment.
// Estados e transições auditadas pelo DeliveryOrchestrator.

export const DELIVERY_ASSIGNMENT_STATES = [
  "PENDENTE",
  "ATRIBUIDO",
  "COLETANDO",
  "EM_ROTA",
  "ENTREGUE",
  "CANCELADO",
] as const;

export type DeliveryAssignmentState = (typeof DELIVERY_ASSIGNMENT_STATES)[number];

export const ALLOWED_TRANSITIONS: Record<DeliveryAssignmentState, DeliveryAssignmentState[]> = {
  PENDENTE: ["ATRIBUIDO", "CANCELADO"],
  ATRIBUIDO: ["COLETANDO", "CANCELADO"],
  COLETANDO: ["EM_ROTA", "CANCELADO"],
  EM_ROTA: ["ENTREGUE", "CANCELADO"],
  ENTREGUE: [],
  CANCELADO: [],
};

export const TERMINAL_STATES: DeliveryAssignmentState[] = ["ENTREGUE", "CANCELADO"];

export function canTransition(from: DeliveryAssignmentState, to: DeliveryAssignmentState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(state: DeliveryAssignmentState): boolean {
  return TERMINAL_STATES.includes(state);
}
