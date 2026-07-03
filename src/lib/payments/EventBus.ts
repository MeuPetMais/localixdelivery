// EventBus interno — publica eventos de pagamento para consumidores futuros
// (Split, Dashboard, Notificações). Sem consumidores registrados por padrão.
//
// Regra: server-only. Componentes nunca importam este módulo.

export type PaymentEventName =
  | "PaymentApproved"
  | "PaymentRejected"
  | "PaymentPending"
  | "PaymentProcessing"
  | "PaymentRefunded"
  | "PaymentCancelled"
  | "PaymentExpired"
  | "PaymentChargeback"
  | "SplitStarted"
  | "SplitCompleted"
  | "SplitFailed";

export interface PaymentEventPayload {
  provider: string;
  orderId: string | null;
  restaurantId: string | null;
  paymentId: string | null;
  amount: number | null;
  currency: string;
  raw?: Record<string, any>;
}

export type PaymentEventHandler = (
  name: PaymentEventName,
  payload: PaymentEventPayload,
) => void | Promise<void>;

const handlers = new Set<PaymentEventHandler>();

export const EventBus = {
  subscribe(h: PaymentEventHandler): () => void {
    handlers.add(h);
    return () => handlers.delete(h);
  },
  async publish(name: PaymentEventName, payload: PaymentEventPayload) {
    for (const h of handlers) {
      try {
        await h(name, payload);
      } catch (err) {
        // Consumidores nunca podem quebrar o publisher.
        console.error("[EventBus] handler falhou", name, err);
      }
    }
  },
  _reset() {
    handlers.clear();
  },
};

export default EventBus;
