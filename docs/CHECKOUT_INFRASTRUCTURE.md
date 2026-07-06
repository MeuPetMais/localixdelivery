# Checkout — Infraestrutura Stripe

## Fluxo atual (auditoria — Fase 1)

```
Carrinho (cliente, /{slug}/checkout)
   │
   ▼
Checkout UI (src/routes/$slug.checkout.tsx)
   │  usa LoyaltyBenefitsBlock + LoyaltyRedeemBlock (apenas leitura)
   ▼
PricingEngine (src/lib/payments/PricingEngine.ts)
   │  calcula subtotal + taxa da plataforma (platform_fees)
   ▼
OrderService (src/lib/checkout/OrderService.ts)
   │  cria pedido; delega registro do pagamento pendente ao facade
   │  `registerPendingOrderPayment` do Payment Domain
   ▼
PaymentService (src/lib/payments/PaymentService.ts)
   │  Provider Pattern — hoje só MercadoPagoProvider
   ▼
Edge Function mp-webhook / mp-oauth
   │  webhook do gateway grava em `payments` / `payment_webhook_events`
   ▼
Finance (leitura via PaymentService)
Loyalty (LoyaltyService — resgates aplicados no OrderService)
Analytics (dashboards leem `payments` / `orders`)
```

**Nada disso muda neste milestone.** O Stripe é adicionado como
infraestrutura paralela, sem substituir nenhum passo do fluxo acima.

## O que este milestone entrega

- `StripeCheckoutService` — contrato para PaymentIntent / CheckoutSession /
  Customer. Validações de entrada ativas; chamadas reais delegadas a
  Edge Functions no próximo milestone.
- `StripePaymentEventMapper` — traduz eventos Stripe para o vocabulário
  do Payment Domain (`PaymentApproved`, `PaymentFailed`, etc.).
- `StripeWebhookService.onPaymentEvent(...)` — canal único para o
  Payment Domain consumir eventos Stripe. Substitui qualquer integração
  ad-hoc.
- `env.ts` — leitura de variáveis com trava **sandbox-only** neste milestone.
- Testes cobrindo validação, mapper e ponte.

## Ponto de integração futuro (não incluso agora)

Quando a Edge Function `stripe-webhook` estiver ativa, ela irá:

1. Verificar assinatura com `STRIPE_WEBHOOK_SECRET_TEST`.
2. Chamar `StripeService.webhooks.parse(rawEvent)`.
3. Chamar `StripeService.webhooks.dispatch(evt, restaurantId)`.
4. Um handler registrado via `StripeService.webhooks.onPaymentEvent(...)`
   dentro do Payment Domain grava em `payments` / `payment_webhook_events`
   através da API pública do domínio.

Assim o Checkout, PricingEngine, Orders, Loyalty, Analytics e Financeiro
**seguem inalterados**.
