// Billing Domain — Restaurant Lifecycle State Machine
// Puro. Sem acesso a banco. Sem side effects além de emitir eventos.

import { BillingEvents } from "./BillingEvents";
import type { RestaurantLifecycleState } from "./types";

const transitions: Record<RestaurantLifecycleState, RestaurantLifecycleState[]> = {
  Draft: ["PendingVerification", "Closed"],
  PendingVerification: ["PendingStripe", "Suspended", "Closed"],
  PendingStripe: ["PendingSetup", "Suspended", "Closed"],
  PendingSetup: ["PendingApproval", "Suspended", "Closed"],
  PendingApproval: ["Production", "Suspended", "Closed"],
  Production: ["Suspended", "Closed"],
  Suspended: ["Production", "Closed"],
  Closed: [],
};

export const RestaurantLifecycleService = {
  canTransition(from: RestaurantLifecycleState, to: RestaurantLifecycleState): boolean {
    return transitions[from]?.includes(to) ?? false;
  },
  transition(
    restaurantId: string,
    from: RestaurantLifecycleState,
    to: RestaurantLifecycleState,
  ): RestaurantLifecycleState {
    if (!this.canTransition(from, to)) {
      throw new Error(`Transição inválida: ${from} -> ${to}`);
    }
    const at = new Date().toISOString();
    BillingEvents.emit({ type: "RestaurantStateChanged", restaurantId, from, to, at });
    if (to === "Production") BillingEvents.emit({ type: "RestaurantApproved", restaurantId, at });
    if (to === "Suspended") BillingEvents.emit({ type: "RestaurantSuspended", restaurantId, at });
    if (to === "Closed") BillingEvents.emit({ type: "RestaurantClosed", restaurantId, at });
    return to;
  },
  allStates(): RestaurantLifecycleState[] {
    return Object.keys(transitions) as RestaurantLifecycleState[];
  },
};
