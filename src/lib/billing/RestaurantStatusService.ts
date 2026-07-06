// Billing Domain — Status derivado do lifecycle.
// Read-only. Não consulta banco aqui — recebe snapshots.

import type { RestaurantBillingSnapshot, RestaurantLifecycleState } from "./types";

export type OperationalStatus = "operational" | "onboarding" | "blocked" | "closed";

const map: Record<RestaurantLifecycleState, OperationalStatus> = {
  Draft: "onboarding",
  PendingVerification: "onboarding",
  PendingStripe: "onboarding",
  PendingSetup: "onboarding",
  PendingApproval: "onboarding",
  Production: "operational",
  Suspended: "blocked",
  Closed: "closed",
};

export const RestaurantStatusService = {
  fromState(state: RestaurantLifecycleState): OperationalStatus {
    return map[state];
  },
  fromSnapshot(s: RestaurantBillingSnapshot): OperationalStatus {
    return this.fromState(s.state);
  },
  isSellingAllowed(s: RestaurantBillingSnapshot): boolean {
    return this.fromSnapshot(s) === "operational";
  },
};
