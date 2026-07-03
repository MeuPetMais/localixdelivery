import type { DeliveryState } from "./types";

export const ALLOWED_DELIVERY_TRANSITIONS: Record<DeliveryState, DeliveryState[]> = {
  WAITING_ASSIGNMENT: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["GOING_TO_RESTAURANT", "CANCELLED", "FAILED"],
  GOING_TO_RESTAURANT: ["WAITING_PICKUP", "CANCELLED", "FAILED"],
  WAITING_PICKUP: ["PICKED_UP", "CANCELLED", "FAILED"],
  PICKED_UP: ["ON_THE_WAY", "RETURNED", "FAILED"],
  ON_THE_WAY: ["ARRIVED", "FAILED", "RETURNED"],
  ARRIVED: ["DELIVERED", "FAILED", "RETURNED"],
  DELIVERED: [],
  FAILED: ["RETURNED"],
  RETURNED: [],
  CANCELLED: [],
};

export function canTransition(from: DeliveryState, to: DeliveryState): boolean {
  return ALLOWED_DELIVERY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(state: DeliveryState): boolean {
  return state === "DELIVERED" || state === "CANCELLED" || state === "RETURNED";
}
