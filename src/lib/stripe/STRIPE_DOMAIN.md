# Stripe Domain

Domínio isolado responsável por toda a integração com **Stripe Connect** —
o gateway oficial da Localix (BD-004).

## Escopo deste milestone

Apenas **infraestrutura**. Nenhuma chamada real à API do Stripe.
Nenhum pagamento é processado. Nenhuma tabela criada.

## Fachada única

Todo consumidor (UI, Billing, futura Edge Function) usa somente
`StripeService`. Serviços internos nunca são importados diretamente.

```ts
import { StripeService } from "@/lib/stripe";

await StripeService.isPending(restaurantId);
await StripeService.startOnboarding(restaurantId, "/pagamentos");
```

## Serviços

| Serviço | Responsabilidade |
|---|---|
| `StripeOAuthService` | Account Links / conectar conta existente / disconnect |
| `StripeAccountService` | Estado da conta conectada, onboarding pendente |
| `StripeCapabilitiesService` | card_payments, transfers, pix, boleto |
| `StripeBalanceService` | Saldo disponível / pendente / reservado |
| `StripeTransferService` | Payouts e transfers |
| `StripeWebhookService` | Parse + dispatch de eventos Stripe |
| `StripeMapper` | Converte payload cru → tipos do domínio |
| `StripeEventBus` | Pub/sub interno do domínio |

## Regras arquiteturais

1. Nenhum módulo fora de `src/lib/stripe/**` pode importar serviços internos.
2. Nenhum arquivo do Stripe Domain importa `@/lib/payments`, `@/lib/checkout`,
   `@/lib/loyalty`, `@/lib/orders`, `@/lib/finance`, `@/lib/billing`.
3. Nenhum arquivo do Stripe Domain acessa Supabase ou o banco.
4. Toda comunicação real com Stripe acontece em Edge Functions (milestone futuro).

## Próximo milestone (não incluso agora)

- Edge Functions `stripe-oauth`, `stripe-webhook`, `stripe-payment-intent`.
- `StripeProvider` implementando `PaymentProvider` — plugado ao registry
  em `src/lib/payments/providers/index.ts` sem mudar `PaymentService`.
