import type { OperationsRole } from "./types";
import type { OrderState } from "@/lib/orders/OrderStateMachine";

export type OperationsAction =
  | "ACCEPT" | "REJECT" | "START_PREP" | "FINISH_PREP" | "DISPATCH" | "CANCEL" | "MARK_DELIVERED";

const MATRIX: Record<OperationsAction, OperationsRole[]> = {
  ACCEPT: ["ADMIN", "MANAGER", "ATTENDANT"],
  REJECT: ["ADMIN", "MANAGER", "ATTENDANT"],
  START_PREP: ["ADMIN", "MANAGER", "KITCHEN"],
  FINISH_PREP: ["ADMIN", "MANAGER", "KITCHEN"],
  DISPATCH: ["ADMIN", "MANAGER", "ATTENDANT"],
  CANCEL: ["ADMIN", "MANAGER"],
  MARK_DELIVERED: ["ADMIN", "MANAGER", "ATTENDANT"],
};

export const ACTION_TO_STATE: Record<OperationsAction, OrderState> = {
  ACCEPT: "aceito",
  REJECT: "rejeitado",
  START_PREP: "em_preparo",
  FINISH_PREP: "pronto",
  DISPATCH: "saiu_para_entrega",
  MARK_DELIVERED: "entregue",
  CANCEL: "cancelado",
};

export function canPerform(role: OperationsRole, action: OperationsAction): boolean {
  return MATRIX[action].includes(role);
}
