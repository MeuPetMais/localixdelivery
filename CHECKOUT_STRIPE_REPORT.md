# Checkout Stripe — Relatório de Entrega

## Auditoria (Fase 1) — fluxo atual mapeado

`Carrinho → Checkout UI (src/routes/$slug.checkout.tsx) → PricingEngine
(src/lib/payments/PricingEngine.ts) → OrderService
(src/lib/checkout/OrderService.ts) → PaymentService
(src/lib/payments/PaymentService.ts) → Provider (Mercado Pago hoje) →
Edge Function mp-webhook → tabelas `payments` / `payment_webhook_events`
→ Finance / Loyalty / Analytics (leitura).`

Detalhes em `CHECKOUT_INFRASTRUCTURE.md`. Nenhum passo foi alterado.

## Arquivos criados

- `src/lib/stripe/StripeCheckoutService.ts`
- `src/lib/stripe/StripePaymentEventMapper.ts`
- `src/lib/stripe/env.ts`
- `src/lib/stripe/StripeCheckout.test.ts`
- `CHECKOUT_INFRASTRUCTURE.md`
- `STRIPE_SANDBOX.md`
- `PAYMENT_EVENTS.md`
- `CHECKOUT_STRIPE_REPORT.md`

## Arquivos alterados

- `src/lib/stripe/StripeService.ts` — expõe `checkout` e
  `paymentEventMapper` na fachada.
- `src/lib/stripe/StripeWebhookService.ts` — ganha canal
  `onPaymentEvent(...)` que traduz eventos Stripe para o vocabulário do
  Payment Domain antes de sair do Stripe Domain.

Nenhum outro arquivo tocado. Sem alterações em:

- `src/lib/payments/**` (Payment Domain / Provider Pattern / PricingEngine
  / Split / Reconciliation / Webhooks MP)
- `src/lib/checkout/**` (OrderService)
- `src/lib/loyalty*`, `src/lib/orders/**`, `src/lib/finance/**`,
  `src/lib/billing/**`, `src/lib/analytics/**`
- `src/routes/$slug.checkout.tsx`

## Cobertura de testes

`src/lib/stripe/StripeCheckout.test.ts` — 12 cenários cobrindo:

- Validação de amount e URLs (`StripeCheckoutService`)
- Mapeamento de todos os eventos exigidos (Fase 3):
  `payment_intent.created`, `processing`, `succeeded`, `payment_failed`,
  `charge.refunded`, `checkout.session.completed`
- Ponte `StripeWebhookService.onPaymentEvent(...)`
- Trava sandbox (`env.ts` / `assertSandboxOnly` / `assertKeyMatchesMode`)

`StripeDomain.test.ts` já entregue no milestone anterior segue passando.

## Trava sandbox

`assertSandboxOnly(readStripeEnv(env))` bloqueia qualquer chamada em
modo `live` neste milestone. Sem chaves reais no cliente.

## Confirmação de desacoplamento

- `rg "from \"@/lib/(payments|checkout|loyalty|orders|finance|billing|analytics)" src/lib/stripe`
  → sem resultados.
- `rg "supabase" src/lib/stripe` → sem resultados.
- Nenhum consumidor externo do Payment Domain foi alterado.
- Toda a nova infra é aditiva e opera **em sandbox** com placeholders —
  o comportamento atual da plataforma não muda.

## Próximo milestone (fora deste)

- Edge Functions `stripe-checkout`, `stripe-webhook`.
- `StripeProvider` implementando `PaymentProvider` — registro no
  `paymentProviders` do Payment Domain.
- Card "Stripe Connect" no painel do restaurante.
- Migração da trava sandbox para chave por tenant.
