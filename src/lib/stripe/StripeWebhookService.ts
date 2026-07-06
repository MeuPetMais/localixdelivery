// Stripe Domain — Webhooks.
// Recebimento e roteamento de eventos Stripe. A verificação real de assinatura
// e persistência serão feitas dentro da Edge Function `stripe-webhook`
// (milestone futuro). Aqui expomos apenas o contrato para o resto do domínio.

import StripeEventBus, { type StripeEventName } from "./StripeEventBus";
import { StripeMapper } from "./StripeMapper";
import { StripePaymentEventMapper, type DomainPaymentEvent, type DomainPaymentPayload } from "./StripePaymentEventMapper";
import type { StripeWebhookEvent } from "./types";

const TYPE_TO_EVENT: Record<string, StripeEventName> = {
  "account.updated": "AccountUpdated",
  "account.application.deauthorized": "AccountDisabled",
  "capability.updated": "CapabilitiesUpdated",
  "balance.available": "BalanceRefreshed",
  "transfer.created": "TransferCreated",
  "transfer.paid": "TransferPaid",
  "transfer.failed": "TransferFailed",
};

export type PaymentEventHandler = (
  name: DomainPaymentEvent,
  payload: DomainPaymentPayload,
) => void | Promise<void>;

const paymentHandlers = new Set<PaymentEventHandler>();

export const StripeWebhookService = {
  parse(raw: Record<string, any>): StripeWebhookEvent {
    return StripeMapper.webhookEvent(raw);
  },

  /**
   * Registra um consumidor para eventos de pagamento já traduzidos para o
   * vocabulário do Payment Domain. Usado pela ponte futura para o
   * PaymentService — nenhum consumidor externo precisa conhecer Stripe.
   */
  onPaymentEvent(handler: PaymentEventHandler): () => void {
    paymentHandlers.add(handler);
    return () => paymentHandlers.delete(handler);
  },

  _resetPaymentHandlers() {
    paymentHandlers.clear();
  },

  async dispatch(event: StripeWebhookEvent, restaurantId: string | null = null): Promise<void> {
    // 1) EventBus interno do Stripe Domain (para observabilidade e eventos de conta).
    await StripeEventBus.publish("WebhookReceived", {
      restaurantId,
      accountId: (event.data as any)?.object?.account ?? null,
      raw: event as unknown as Record<string, unknown>,
    });

    const mapped = TYPE_TO_EVENT[event.type];
    if (mapped) {
      await StripeEventBus.publish(mapped, {
        restaurantId,
        accountId: (event.data as any)?.object?.id ?? null,
        raw: event.data as Record<string, unknown>,
      });
    }

    // 2) Ponte para o Payment Domain — eventos de pagamento são traduzidos
    //    pelo mapper antes de sair do Stripe Domain.
    const domainEvent = StripePaymentEventMapper.toDomain(event);
    if (domainEvent) {
      for (const h of paymentHandlers) {
        try {
          await h(domainEvent.name, domainEvent.payload);
        } catch (err) {
          console.error("[StripeWebhookService] payment handler falhou", domainEvent.name, err);
        }
      }
    }
  },
};

export default StripeWebhookService;
