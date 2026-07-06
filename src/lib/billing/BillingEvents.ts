// Billing Domain — Event Bus (in-process)
// Desacoplado: consumidores externos podem se inscrever sem que o domínio
// os conheça.

import type { RestaurantLifecycleState } from "./types";

export type BillingEvent =
  | { type: "RestaurantCreated"; restaurantId: string; at: string }
  | { type: "RestaurantStateChanged"; restaurantId: string; from: RestaurantLifecycleState; to: RestaurantLifecycleState; at: string }
  | { type: "EligibilityEvaluated"; restaurantId: string; eligible: boolean; at: string }
  | { type: "OnboardingStepCompleted"; restaurantId: string; stepId: string; at: string }
  | { type: "OnboardingCompleted"; restaurantId: string; at: string }
  | { type: "RestaurantApproved"; restaurantId: string; at: string }
  | { type: "RestaurantSuspended"; restaurantId: string; reason?: string; at: string }
  | { type: "RestaurantClosed"; restaurantId: string; reason?: string; at: string }
  | { type: "ServiceFeeQuoted"; restaurantId: string; perOrderFee: number; at: string };

type Handler = (event: BillingEvent) => void;

const handlers = new Set<Handler>();

export const BillingEvents = {
  emit(event: BillingEvent) {
    for (const h of handlers) {
      try { h(event); } catch { /* isolar consumidores */ }
    }
  },
  on(handler: Handler): () => void {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
  clear() { handlers.clear(); },
};
