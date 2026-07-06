# Billing — Eventos

Todos os eventos são in-process e emitidos por `BillingEvents.emit()`.
Assinatura: `BillingEvents.on(handler): unsubscribe`.

| Evento | Origem | Payload principal |
|---|---|---|
| `RestaurantCreated` | consumidor externo | `restaurantId` |
| `RestaurantStateChanged` | `RestaurantLifecycleService.transition` | `from`, `to` |
| `RestaurantApproved` | transição para `Production` | `restaurantId` |
| `RestaurantSuspended` | transição para `Suspended` | `restaurantId` |
| `RestaurantClosed` | transição para `Closed` | `restaurantId` |
| `EligibilityEvaluated` | `EligibilityService` (opcional) | `eligible` |
| `OnboardingStepCompleted` | `OnboardingService.completeStep` | `stepId` |
| `OnboardingCompleted` | consumidor externo | `restaurantId` |
| `ServiceFeeQuoted` | `ServiceFeeService.quote` | `perOrderFee` |

## Contrato

Handlers **não podem** quebrar o emissor — o bus isola exceções.
Handlers **não devem** mutar o evento recebido.
