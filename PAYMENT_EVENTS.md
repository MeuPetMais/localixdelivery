# Payment Events — Contrato do Payment Domain

Eventos internos do Payment Domain (vocabulário estável, independente de
gateway). Todo gateway (Mercado Pago, Stripe, futuros) deve traduzir seus
eventos brutos para esta lista.

| Evento              | Quando                                              |
|---------------------|-----------------------------------------------------|
| `PaymentCreated`    | Intent criada; ainda não iniciada pelo cliente      |
| `PaymentProcessing` | Cliente iniciou pagamento; aguardando confirmação   |
| `PaymentApproved`   | Pagamento confirmado                                |
| `PaymentFailed`     | Falha (recusa, expiração de método, etc.)           |
| `PaymentCancelled`  | Cancelado pelo cliente ou pelo sistema              |
| `PaymentRefunded`   | Estorno total ou parcial                            |
| `CheckoutCompleted` | Sessão de checkout finalizada (Stripe Checkout)     |

## Payload padrão

```ts
{
  provider: "stripe" | "mercado_pago",
  eventId: string,
  paymentIntentId: string | null,
  checkoutSessionId: string | null,
  orderId: string | null,
  restaurantId: string | null,
  amount: number | null,
  currency: string,
  status: string | null,
  raw: Record<string, unknown>,
}
```

## Mapeamento Stripe → Payment Domain

Implementado em `src/lib/stripe/StripePaymentEventMapper.ts`.

| Stripe                            | Payment Domain     |
|-----------------------------------|--------------------|
| `payment_intent.created`          | `PaymentCreated`   |
| `payment_intent.processing`       | `PaymentProcessing`|
| `payment_intent.succeeded`        | `PaymentApproved`  |
| `payment_intent.payment_failed`   | `PaymentFailed`    |
| `payment_intent.canceled`         | `PaymentCancelled` |
| `charge.refunded`                 | `PaymentRefunded`  |
| `checkout.session.completed`      | `CheckoutCompleted`|

## Regras

- Consumidores fora do Payment Domain **nunca** consomem o payload cru do
  gateway. Sempre o vocabulário acima.
- `order_id` e `restaurant_id` chegam via `metadata` do PaymentIntent /
  Checkout Session. Toda criação de intent obrigatoriamente popula essa
  metadata.
- Eventos duplicados são deduplicados pelo `eventId` na camada de
  persistência (`payment_webhook_events`).
