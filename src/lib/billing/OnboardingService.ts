// Billing Domain — Onboarding do restaurante.
// Puro. Constrói checklists baseados no lifecycle atual.

import type { OnboardingChecklist, RestaurantLifecycleState } from "./types";
import { BillingEvents } from "./BillingEvents";

interface StepInput {
  verified: boolean;
  gatewayConnected: boolean;
  setupComplete: boolean;
  approved: boolean;
}

export const OnboardingService = {
  buildChecklist(restaurantId: string, input: StepInput): OnboardingChecklist {
    const items = [
      { id: "verification", title: "Verificação de identidade", done: input.verified, blocking: true },
      { id: "gateway",      title: "Conectar gateway de pagamento", done: input.gatewayConnected, blocking: true },
      { id: "setup",        title: "Configurar cardápio e entrega", done: input.setupComplete, blocking: true },
      { id: "approval",     title: "Aprovação final da Localix", done: input.approved, blocking: true },
    ];
    const done = items.filter(i => i.done).length;
    return {
      restaurantId,
      items,
      completedPct: Math.round((done / items.length) * 100),
    };
  },
  completeStep(restaurantId: string, stepId: string) {
    BillingEvents.emit({
      type: "OnboardingStepCompleted",
      restaurantId,
      stepId,
      at: new Date().toISOString(),
    });
  },
  nextExpectedState(current: RestaurantLifecycleState): RestaurantLifecycleState | null {
    const order: RestaurantLifecycleState[] = [
      "Draft", "PendingVerification", "PendingStripe",
      "PendingSetup", "PendingApproval", "Production",
    ];
    const idx = order.indexOf(current);
    return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  },
};
