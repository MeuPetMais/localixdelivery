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
  CREATED: ["system", "customer"],
  WAITING_PAYMENT: ["system"],
  PAYMENT_APPROVED: ["webhook", "system", "admin"],
  PAYMENT_FAILED: ["webhook", "system", "admin"],
  RESTAURANT_ACCEPTED: ["restaurant", "admin"],
  RESTAURANT_REJECTED: ["restaurant", "admin"],
  PREPARING: ["restaurant", "admin"],
  READY: ["restaurant", "admin"],
  OUT_FOR_DELIVERY: ["restaurant", "courier", "admin"],
  DELIVERED: ["courier", "restaurant", "admin"],
  COMPLETED: ["system", "admin"],
  CANCELLED: ["customer", "restaurant", "admin", "system"],
  REFUNDED: ["admin", "webhook", "system"],
  CHARGEBACK: ["webhook", "admin", "system"],
};

export function canActorPerform(actor: OrderActorType, target: OrderState): boolean {
  return (PERMISSIONS[target] ?? []).includes(actor);
}
