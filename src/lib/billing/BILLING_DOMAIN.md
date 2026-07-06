# Billing Domain

Domínio oficial de inteligência comercial da Localix. Totalmente desacoplado
de Payments, Checkout, Loyalty e PricingEngine.

## Responsabilidades

- Ciclo de vida do restaurante (Draft → Production → Suspended/Closed).
- Elegibilidade comercial (BD-008, BD-009).
- Onboarding (checklists e próximos passos).
- Política oficial da taxa de serviço (BD-003: R$0,99 / pedido).
- Status operacional derivado.
- Barramento de eventos comerciais.

## Não faz parte deste domínio

- Integração com Stripe / Mercado Pago (Payment Domain).
- Cálculo de preço do pedido (PricingEngine).
- Fidelidade / cashback (Loyalty Domain).
- Persistência (a ser adicionada em fase posterior — hoje o domínio é puro).

## Serviços

| Serviço | Papel |
|---|---|
| `BillingService` | Fachada única de acesso |
| `EligibilityService` | Avalia critérios de entrada |
| `RestaurantLifecycleService` | Máquina de estados |
| `RestaurantStatusService` | Status operacional derivado |
| `OnboardingService` | Checklist e próximos passos |
| `ServiceFeeService` | Política oficial da taxa |
| `BillingEvents` | Event bus in-process |

## Entrada única

```ts
import { BillingService } from "@/lib/billing";
```
