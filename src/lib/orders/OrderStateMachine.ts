// State Machine central de pedidos do Localix.
// Regra: nenhum módulo pode alterar status diretamente. Toda transição passa
// pelo OrderOrchestrator, que consulta este arquivo para validar.
//
// FONTE ÚNICA DE VERDADE: os valores abaixo são idênticos aos aceitos pela
// constraint `orders_status_check` no banco. Não criar aliases nem paralelos.

export type OrderState =
  | "novo"
  | "aguardando_pagamento"
  | "pago"
  | "falha_pagamento"
  | "aceito"
  | "rejeitado"
  | "em_preparo"
  | "pronto"
  | "saiu_para_entrega"
  | "entregue"
  | "concluido"
  | "cancelado"
  | "reembolsado"
  | "chargeback";

export const ORDER_STATES: OrderState[] = [
  "novo",
  "aguardando_pagamento",
  "pago",
  "falha_pagamento",
  "aceito",
  "rejeitado",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
  "entregue",
  "concluido",
  "cancelado",
  "reembolsado",
  "chargeback",
];

// Estados terminais: nenhuma transição de saída permitida.
export const TERMINAL_STATES: OrderState[] = [
  "concluido",
  "cancelado",
  "reembolsado",
  "chargeback",
  "rejeitado",
];

// Mapa de transições permitidas. Qualquer transição fora deste mapa é inválida.
export const ALLOWED_TRANSITIONS: Record<OrderState, OrderState[]> = {
  novo: ["aguardando_pagamento", "cancelado"],
  aguardando_pagamento: ["pago", "falha_pagamento", "cancelado"],
  pago: ["aceito", "rejeitado", "reembolsado", "chargeback", "cancelado"],
  falha_pagamento: ["aguardando_pagamento", "cancelado"],
  aceito: ["em_preparo", "cancelado", "reembolsado"],
  rejeitado: [],
  em_preparo: ["pronto", "cancelado"],
  pronto: ["saiu_para_entrega", "entregue", "cancelado"],
  saiu_para_entrega: ["entregue", "cancelado"],
  entregue: ["concluido", "reembolsado", "chargeback"],
  concluido: ["reembolsado", "chargeback"],
  cancelado: [],
  reembolsado: [],
  chargeback: [],
};

export function isTerminal(state: OrderState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function canTransition(from: OrderState, to: OrderState): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}
