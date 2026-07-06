// Stripe Domain — Tipos.
// Pure types. Nenhuma dependência de SDK, banco ou API externa.

export type StripeMode = "test" | "live";

export type StripeAccountStatus =
  | "not_created"
  | "onboarding_pending"
  | "onboarding_incomplete"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

export interface StripeAccount {
  id: string;                       // acct_...
  restaurantId: string;
  status: StripeAccountStatus;
  country: string;
  defaultCurrency: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  createdAt: string;
}

export interface StripeCapabilities {
  cardPayments: "active" | "pending" | "inactive";
  transfers: "active" | "pending" | "inactive";
  boletoPayments?: "active" | "pending" | "inactive";
  pixPayments?: "active" | "pending" | "inactive";
}

export interface StripeBalance {
  available: number;   // menor unidade (centavos)
  pending: number;
  reserved: number;
  currency: string;
}

export interface StripeTransfer {
  id: string;
  amount: number;
  currency: string;
  destination: string;
  createdAt: string;
  status: "paid" | "pending" | "failed" | "in_transit";
}

export interface StripeOnboardingLink {
  url: string;
  expiresAt: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  createdAt: string;
  livemode: boolean;
  data: Record<string, unknown>;
}
