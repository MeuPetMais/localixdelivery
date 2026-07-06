// Stripe Domain — Fachada única.
// Toda interação com o Stripe Connect passa por aqui.
//
// Regras arquiteturais:
//  - Nenhum consumidor fora de `src/lib/stripe/**` pode importar os serviços
//    internos diretamente. Sempre usar `StripeService`.
//  - O Stripe Domain é totalmente desacoplado: não importa Billing, Payments,
//    Checkout, Loyalty, PricingEngine, Orders ou Finance.
//  - Toda comunicação real com a API do Stripe acontece em Edge Functions
//    (milestone de pagamentos). Este milestone é apenas infraestrutura.

import { StripeAccountService } from "./StripeAccountService";
import { StripeBalanceService } from "./StripeBalanceService";
import { StripeCapabilitiesService } from "./StripeCapabilitiesService";
import { StripeCheckoutService } from "./StripeCheckoutService";
import { StripeConnectService } from "./StripeConnectService";
import { StripeOAuthService } from "./StripeOAuthService";
import { StripeTransferService } from "./StripeTransferService";
import { StripeWebhookService } from "./StripeWebhookService";
import { StripeEventBus } from "./StripeEventBus";
import { StripeMapper } from "./StripeMapper";
import { StripePaymentEventMapper } from "./StripePaymentEventMapper";

export const StripeService = {
  account: StripeAccountService,
  balance: StripeBalanceService,
  capabilities: StripeCapabilitiesService,
  checkout: StripeCheckoutService,
  connect: StripeConnectService,
  oauth: StripeOAuthService,
  transfers: StripeTransferService,
  webhooks: StripeWebhookService,
  events: StripeEventBus,
  mapper: StripeMapper,
  paymentEventMapper: StripePaymentEventMapper,

  // Onboarding — atalhos convenientes.
  async startOnboarding(restaurantId: string, returnUrl?: string) {
    return StripeOAuthService.createAccountLink(restaurantId, returnUrl);
  },
  async connectExisting(restaurantId: string, stripeAccountId: string) {
    return StripeOAuthService.connectExistingAccount(restaurantId, stripeAccountId);
  },
  async isPending(restaurantId: string) {
    return StripeAccountService.hasPendingOnboarding(restaurantId);
  },
};

export type { StripeEventName, StripeEventPayload } from "./StripeEventBus";
export * from "./types";
export default StripeService;
