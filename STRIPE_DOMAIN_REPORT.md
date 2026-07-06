# Stripe Domain — Relatório de Entrega

## Auditoria (Fase 1)

- **PaymentService** (`src/lib/payments/PaymentService.ts`) — fachada; Provider Pattern intacto.
- **Providers** — `MercadoPagoProvider` único hoje; `paymentProviders` aceita novos sem mudança de contrato.
- **Split / Reconciliation / Webhooks** — encapsulados em `src/lib/payments/**`, `service_role` only para writes de webhook.
- **PricingEngine** — cobra fee via `platform_fees` (não conhece gateway).
- **Finance** — consome `PaymentService`; nenhum acesso a gateway direto.
- **Billing Domain** — pura lógica comercial; não conhece gateway.

Confirmado: adicionar Stripe é uma alteração **puramente local** no
Payment Domain (registry de providers). Nenhum consumidor externo muda.

## Arquivos criados

- `src/lib/stripe/types.ts`
- `src/lib/stripe/StripeService.ts`
- `src/lib/stripe/StripeOAuthService.ts`
- `src/lib/stripe/StripeAccountService.ts`
- `src/lib/stripe/StripeCapabilitiesService.ts`
- `src/lib/stripe/StripeBalanceService.ts`
- `src/lib/stripe/StripeTransferService.ts`
- `src/lib/stripe/StripeWebhookService.ts`
- `src/lib/stripe/StripeMapper.ts`
- `src/lib/stripe/StripeEventBus.ts`
- `src/lib/stripe/index.ts`
- `src/lib/stripe/StripeDomain.test.ts`
- `src/lib/stripe/STRIPE_DOMAIN.md`
- `STRIPE_CONNECT_ARCHITECTURE.md`
- `STRIPE_DOMAIN_REPORT.md`

## Arquivos alterados

Nenhum. O Stripe Domain é aditivo — nada foi modificado em:

- `src/lib/payments/**`
- `src/lib/billing/**`
- `src/lib/checkout/**`
- `src/lib/loyalty*`
- `src/lib/orders/**`
- `src/lib/finance/**`
- PricingEngine, Checkout, Financeiro.

## Cobertura de testes

`src/lib/stripe/StripeDomain.test.ts` — mapper (active/pending/rejected/balance),
capabilities, formatação de balance, webhooks + EventBus, placeholders do
StripeService. **10 cenários**.

## Confirmação de desacoplamento

Verificações:

- `rg "from \"@/lib/(payments|checkout|loyalty|orders|finance|billing)" src/lib/stripe` → **sem resultados**.
- `rg "supabase" src/lib/stripe` → **sem resultados**.
- Consumidores externos só podem importar `StripeService` a partir de `@/lib/stripe`.

Stripe Domain está **totalmente desacoplado**, pronto para plugar
`StripeProvider` no Payment Domain quando o milestone de pagamentos for
iniciado.

## Fora deste milestone

- Card "Stripe Connect" no painel do restaurante (Fase 4) — será
  implementado junto com as Edge Functions reais para evitar UI ligada a
  placeholders que sempre lançam erro.
- Onboarding real, saldo real, transferências reais — dependem das
  Edge Functions `stripe-oauth` / `stripe-webhook` (próximo milestone).
