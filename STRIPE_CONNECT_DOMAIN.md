# Stripe Connect Domain

Domínio responsável por prover cada restaurante da Localix uma conta
**Stripe Connect Express** própria. Faz parte do Stripe Domain e é
consumido apenas via `StripeService.connect`.

## Fachada única

```ts
import { StripeService } from "@/lib/stripe";

await StripeService.connect.createExpressAccount(restaurantId);
await StripeService.connect.createAccountLink(restaurantId);
await StripeService.connect.refreshAccount(restaurantId);
await StripeService.connect.disconnectAccount(restaurantId);
```

## Serviços

| Método | Responsabilidade |
|---|---|
| `createExpressAccount` | Cria account Express na Stripe + Account Link inicial |
| `createAccountLink` | Novo Account Link para conta existente |
| `refreshAccount` / `retrieveAccount` / `syncCapabilities` | Consulta Stripe + persiste snapshot local |
| `disconnectAccount` | Limpa colunas `stripe_*` do restaurante (não deleta na Stripe) |

## Edge Functions

- `stripe-connect-create` — `verify_jwt=true`. Valida owner do restaurante,
  cria account Express, gera Account Link, persiste `stripe_account_id`.
- `stripe-connect-refresh` — `verify_jwt=true`. `accounts.retrieve` +
  atualiza colunas locais + retorna snapshot.

Chaves Stripe **nunca** vão para o frontend. Toda comunicação com a API da
Stripe acontece dentro das Edge Functions usando `STRIPE_SECRET_KEY_TEST`.

## Modelagem (public.restaurants)

- `stripe_account_id text UNIQUE`
- `stripe_account_type text DEFAULT 'express'`
- `stripe_onboarding_completed boolean`
- `stripe_charges_enabled boolean`
- `stripe_payouts_enabled boolean`
- `stripe_details_submitted boolean`
- `stripe_account_status text` — `not_created | onboarding_pending | active | restricted | rejected | disabled`
- `stripe_last_sync timestamptz`

Sem tabela nova — reutiliza o Restaurant Domain.

## Regras arquiteturais

1. Nada fora de `src/lib/stripe/**` importa `StripeConnectService`
   diretamente — sempre via `StripeService.connect`.
2. Este domínio **não** altera Checkout, PaymentService, PricingEngine,
   Loyalty, Orders, Analytics, PlatformRevenue.
3. Billing consome apenas via `BillingService.paymentsReadiness` (leitura).
