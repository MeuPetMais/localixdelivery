# Central de Gateways — Payment Domain

## Objetivo
Permitir que cada restaurante conecte múltiplos gateways de pagamento e
escolha qual será utilizado no checkout. A tela `/pagamentos` é a única
superfície de configuração; o restante da aplicação nunca conhece o
gateway em uso.

## Arquitetura

```
Checkout ($slug.index.tsx)
   │
   ▼
PaymentService.createPayment()
   │
   ├── getPrimaryProvider(restaurantId) ── restaurants.payment_provider
   │
   ▼
Provider Pattern (StripeProvider | MercadoPagoProvider)
   │
   ▼
Edge Functions (stripe-checkout | mp-payment-intent)
   │
   ▼
Gateway externo
```

Regras do domínio (herdadas de `DOMAIN_MANIFEST_PAYMENT.md`):

1. Nenhum consumidor fora de `src/lib/payments/**` conhece Stripe/MP.
2. Toda cobrança passa por `PaymentService.createPayment`.
3. Segredos vivem exclusivamente em Edge Functions.

## Provider Pattern

Cada gateway implementa `PaymentProvider`:

- `startOAuth / getStatus / disconnect` — conexão do restaurante.
- `createCheckout` — cobrança PIX/cartão.

Providers registrados em `src/lib/payments/providers/index.ts`. Adicionar
um novo gateway = criar um `NovoProvider.ts`, registrar no `paymentProviders`
e liberar no CHECK constraint da coluna `payment_provider`.

## Configuração por restaurante

Coluna: `public.restaurants.payment_provider text NOT NULL DEFAULT 'stripe'`.

- Valores permitidos: `stripe`, `mercado_pago`.
- Persistido via `PaymentService.setPrimaryProvider(restaurantId, providerId)`.
- Lido via `PaymentService.getPrimaryProvider(restaurantId)`.

## Fluxo do Checkout

1. Usuário confirma o pedido no `$slug.index.tsx`.
2. `PaymentService.assertPrimaryReady(restaurantId)` — se o gateway
   principal estiver desconectado, o checkout é bloqueado com
   `"Nenhum gateway de pagamento configurado."`.
3. `PaymentService.createPayment({ restaurantId, ...})` resolve o
   provider e delega para a Edge Function correta.

## UI — `/pagamentos`

- Card **Stripe Connect** — status, PIX/cartão/payouts, sincronizar.
- Card **Mercado Pago** — status OAuth, PIX/cartão/webhook.
- Seção **Gateway principal** — radio com salvamento automático.
- Indicadores 🟢/🟡/🔴 para PIX, Cartão, Webhook.

## Testes

- `PaymentService.test.ts` — Provider Pattern + validação de entrada.
- `PaymentGateways.test.ts` — get/set primary provider + guards.
