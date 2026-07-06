// Stripe Domain — Webhooks.
// Recebimento e roteamento de eventos Stripe. A verificação real de assinatura
// e persistência serão feitas dentro da Edge Function `stripe-webhook`
// (milestone futuro). Aqui expomos apenas o contrato para o resto do domínio.

import StripeEventBus, { type StripeEventName } from "./StripeEventBus";
import { StripeMapper } from "./StripeMapper";
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

export const StripeWebhookService = {
  parse(raw: Record<string, any>): StripeWebhookEvent {
    return StripeMapper.webhookEvent(raw);
  },

  async dispatch(event: StripeWebhookEvent, restaurantId: string | null = null): Promise<void> {
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
  },
};

export default StripeWebhookService;
