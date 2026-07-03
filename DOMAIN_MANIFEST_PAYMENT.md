# Payment Domain — Manifest

## Public API (única porta de entrada)
- `PaymentService` (`src/lib/payments/PaymentService.ts`)
  - `provider(id?)` / `listProviders()`
  - `connect(providerId, restaurantId, redirectTo?)`
  - `connectionStatus(providerId, restaurantId)`
  - `disconnect(providerId, restaurantId)`
  - `calcFees(subtotal)`
  - `createPayment(input)` *(placeholder — Prompt 5)*
  - `refreshStatus(paymentId)` *(placeholder — Prompt 5)*
  - `listByRestaurant(restaurantId, limit?)`
- Facade server-only: `src/lib/payments/orderPayment.server.ts`
  - `registerPendingOrderPayment(input)` — usado pelo checkout.

## Providers (Provider Pattern)
- `src/lib/payments/providers/*` — implementações concretas (Mercado Pago hoje).
- Nenhum consumidor fora do domínio pode conhecer o provider.

## Serviços internos (não expor fora do domínio)
- `PricingEngine`, `SplitService`, `ReconciliationService`,
  `PaymentIntentService`, `WebhookService`, `EventBus`.

## Tabelas gerenciadas exclusivamente pelo domínio
`payments`, `payment_split`, `payment_reconciliation`,
`mercado_pago_accounts`, `payment_providers`, `payment_webhook_events`,
`payment_logs`, `payment_event_queue`, `order_payment`,
`tenant_payment_settings`, `platform_fees`.

## Regras
1. Nenhum módulo fora de `src/lib/payments/**` pode:
   - Importar `providers/*`.
   - Fazer `.from("<tabela do domínio>")`.
   - Referenciar nomes de gateways (Mercado Pago, Stripe, Asaas, Pagar.me).
2. Toda operação de pagamento passa por `PaymentService` (ou pelo facade
   server-only para writes de checkout).
3. OAuth vive somente em `/pagamentos` — reutilizado por qualquer módulo
   via `PaymentService.connect()` / navegação para `/pagamentos`.
