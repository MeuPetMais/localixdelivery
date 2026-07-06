# Stripe Split — Automático via Connect Express

## Fluxo

```text
Cliente ──▶ Checkout ──▶ PricingEngine
                            │
                            ▼
                     PlatformRevenueService.getCurrentServiceFee()
                            │
                            ▼
                     stripe-checkout (edge)
                            │
                            ├── platform_fee_amount = fee (em centavos)
                            └── transfer_data.destination = acct_restaurante
                            ▼
                       Stripe Checkout Session
                            ▼
                    Cliente paga na Stripe
                            ▼
              Split automático: Localix ← fee, Restaurante ← líquido
                            ▼
                    Webhook stripe-webhook
                            ├── payments.status = approved
                            ├── orders.status = pago
                            ├── financial_ledger (idempotente)
                            └── payment_split (idempotente por PI)
```

## Regras invioláveis

- **A taxa da plataforma vem SEMPRE de `PlatformRevenueService`** (via
  `platform_settings` no edge — mesma fonte). Nenhum valor hardcoded.
- Split só é aplicado quando o restaurante tem `stripe_account_status='active'`
  E `stripe_charges_enabled=true`.
- Se não houver split elegível, checkout mantém fluxo atual (sem Connect).
- Somente `StripeSplitService` conhece as regras — nenhum outro service duplica.

## Idempotência

- `payment_webhook_events (provider, event_id)` — dedup do evento Stripe.
- `financial_ledger (provider, reference_type, reference_id)` — dedup do lançamento.
- `payment_split (provider, split_reference)` — dedup do split.

Reentregar o mesmo `payment_intent.succeeded` **não** duplica valores.

## Contratos

```ts
StripeService.split.calculateSplit({ amount, restaurantStripeAccountId, orderId, restaurantId })
StripeService.split.buildTransferData(split, ids)
StripeService.split.validateSplit(split)
StripeService.split.summarizeSplit(split)
```

`validateSplit` garante: `platformFee ∈ [0, gross]`, `sum(platform + restaurant) == gross ± 0.01`, `destination` começa com `acct_`.
