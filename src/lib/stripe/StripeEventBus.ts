// Stripe Domain — EventBus interno.
// Publica eventos relacionados ao Stripe Connect para consumidores futuros
// (Billing, Onboarding UI, Notifications). Sem consumidores registrados por padrão.
//
// Regra: nunca cruza fronteira de domínio — apenas outros módulos internos do
// Stripe Domain podem se inscrever. Nada de importar em componentes React.

export type StripeEventName =
  | "AccountCreated"
  | "AccountUpdated"
  | "AccountRestricted"
  | "AccountDisabled"
  | "OnboardingStarted"
  | "OnboardingCompleted"
  | "OnboardingPending"
  | "CapabilitiesUpdated"
  | "BalanceRefreshed"
  | "TransferCreated"
  | "TransferPaid"
  | "TransferFailed"
  | "WebhookReceived";

export interface StripeEventPayload {
  restaurantId: string | null;
  accountId: string | null;
  raw?: Record<string, unknown>;
}

export type StripeEventHandler = (
  name: StripeEventName,
  payload: StripeEventPayload,
) => void | Promise<void>;

const handlers = new Set<StripeEventHandler>();

export const StripeEventBus = {
  subscribe(h: StripeEventHandler): () => void {
    handlers.add(h);
    return () => handlers.delete(h);
  },
  async publish(name: StripeEventName, payload: StripeEventPayload) {
    for (const h of handlers) {
      try {
        await h(name, payload);
      } catch (err) {
        console.error("[StripeEventBus] handler falhou", name, err);
      }
    }
  },
  _reset() {
    handlers.clear();
  },
};

export default StripeEventBus;
