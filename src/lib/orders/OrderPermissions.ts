// Define quem pode executar cada transição de estado.
// Nunca conceder permissões extras sem revisar segurança.
import type { OrderState } from "./OrderStateMachine";

export type OrderActorType =
  | "customer"
  | "restaurant"
  | "admin"
  | "system"
  | "webhook"
  | "courier";

// Estado alvo → atores permitidos.
export const PERMISSIONS: Record<OrderState, OrderActorType[]> = {
  novo: ["system", "customer"],
  aguardando_pagamento: ["system"],
  pago: ["webhook", "system", "admin"],
  falha_pagamento: ["webhook", "system", "admin"],
  aceito: ["restaurant", "admin"],
  rejeitado: ["restaurant", "admin"],
  em_preparo: ["restaurant", "admin"],
  pronto: ["restaurant", "admin"],
  saiu_para_entrega: ["restaurant", "courier", "admin"],
  entregue: ["courier", "restaurant", "admin"],
  concluido: ["restaurant", "system", "admin"],
  cancelado: ["customer", "restaurant", "admin", "system"],
  reembolsado: ["admin", "webhook", "system"],
  chargeback: ["webhook", "admin", "system"],
};

export function canActorPerform(actor: OrderActorType, target: OrderState): boolean {
  return (PERMISSIONS[target] ?? []).includes(actor);
}
