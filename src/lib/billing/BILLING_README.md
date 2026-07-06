# Billing Domain — README

Fase **Commercial Readiness** da Localix.

## Uso rápido

```ts
import { BillingService } from "@/lib/billing";

// Elegibilidade
const r = BillingService.eligibility.evaluate({
  monthlyOrders: 720, averageTicket: 38,
});

// Lifecycle
BillingService.lifecycle.transition("rest_1", "PendingApproval", "Production");

// Status
BillingService.status.fromState("Production"); // "operational"

// Taxa de serviço
BillingService.serviceFee.quote("rest_1"); // R$0,99 / pedido confirmado

// Eventos
const off = BillingService.events.on((ev) => console.log(ev.type));
off();
```

## O que NÃO fazer

- Não importar Stripe / Mercado Pago aqui.
- Não chamar Supabase diretamente deste domínio.
- Não misturar com PricingEngine (preço do pedido) nem com Loyalty.

## Testes

`src/lib/billing/BillingDomain.test.ts` — cobre lifecycle, elegibilidade,
onboarding, status e taxa de serviço.
