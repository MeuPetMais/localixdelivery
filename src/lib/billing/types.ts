// Billing Domain — types
// Domínio comercial da Localix. Totalmente desacoplado de Payments,
// Checkout, Loyalty e PricingEngine.

export type RestaurantLifecycleState =
  | "Draft"
  | "PendingVerification"
  | "PendingStripe"
  | "PendingSetup"
  | "PendingApproval"
  | "Production"
  | "Suspended"
  | "Closed";

export type BillingPlan = "standard"; // único plano oficial (BD-002)

export interface EligibilityCriteria {
  minMonthlyOrders: number;   // 600 (BD-008)
  minTicket: number;          // 20 (BD-009)
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  criteria: EligibilityCriteria;
  observed: { monthlyOrders: number; averageTicket: number };
}

export interface RestaurantBillingSnapshot {
  restaurantId: string;
  state: RestaurantLifecycleState;
  plan: BillingPlan;
  gatewayConnected: boolean;
  approvedAt?: string;
  suspendedAt?: string;
  closedAt?: string;
}

export interface ServiceFeeQuote {
  perOrderFee: number;   // 0.99 (BD-003)
  currency: "BRL";
  appliesTo: "confirmed_order";
}

export interface OnboardingChecklistItem {
  id: string;
  title: string;
  done: boolean;
  blocking: boolean;
}

export interface OnboardingChecklist {
  restaurantId: string;
  items: OnboardingChecklistItem[];
  completedPct: number;
}
