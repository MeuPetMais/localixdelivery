# Stripe Connect — Arquitetura

## Posicionamento

Stripe Connect é o **gateway oficial** da Localix (BD-004).
Fica isolado em um novo domínio: `src/lib/stripe/**`.

```
UI / Billing
    │
    ▼
StripeService  (fachada única)
    │
    ├── StripeOAuthService ──────► Edge Function stripe-oauth (futuro)
    ├── StripeAccountService
    ├── StripeCapabilitiesService
    ├── StripeBalanceService
    ├── StripeTransferService
    ├── StripeWebhookService ────► Edge Function stripe-webhook (futuro)
    │
    ├── StripeMapper
    └── StripeEventBus  ─── publish ── AccountUpdated, TransferPaid, ...
```

## Integração futura com Payment Domain

Quando o Stripe estiver ativo em produção:

1. Criar `StripeProvider` em `src/lib/payments/providers/StripeProvider.ts`
   implementando `PaymentProvider`.
2. Delegar toda a lógica a `StripeService` (nenhuma chamada Stripe direta).
3. Registrar em `paymentProviders` — `PaymentService` passa a expor o novo
   gateway automaticamente, sem qualquer alteração no checkout.

## Desacoplamento

- Stripe Domain **não conhece** Billing, Loyalty, Checkout, Orders,
  Finance ou PricingEngine.
- Stripe Domain **não acessa** o banco.
- Consumidores externos usam **apenas** `StripeService`.

## Segurança

- Chaves `sk_live_` / `sk_test_` **jamais** no frontend.
- Toda comunicação real Stripe ↔ backend ocorre em Edge Functions
  (`stripe-oauth`, `stripe-webhook`, futuro).
- Webhooks verificam assinatura Stripe antes de qualquer dispatch.
- Modo `test` / `live` derivado de env do backend.
