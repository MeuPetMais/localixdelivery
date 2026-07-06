// Billing Domain — Fachada única.
// Toda a inteligência comercial da Localix passa por aqui.

import { EligibilityService } from "./EligibilityService";
import { OnboardingService } from "./OnboardingService";
import { PaymentsReadinessService } from "./PaymentsReadinessService";
import { RestaurantLifecycleService } from "./RestaurantLifecycleService";
import { RestaurantStatusService } from "./RestaurantStatusService";
import { ServiceFeeService } from "./ServiceFeeService";
import { BillingEvents } from "./BillingEvents";

export const BillingService = {
  eligibility: EligibilityService,
  onboarding: OnboardingService,
  lifecycle: RestaurantLifecycleService,
  paymentsReadiness: PaymentsReadinessService,
  status: RestaurantStatusService,
  serviceFee: ServiceFeeService,
  events: BillingEvents,
};

export type { BillingEvent } from "./BillingEvents";
export * from "./types";
