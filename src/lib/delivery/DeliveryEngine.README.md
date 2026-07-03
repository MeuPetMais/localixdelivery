# Delivery Engine

Infraestrutura híbrida de logística do Localix. Não altera nenhum módulo existente
(OAuth, PricingEngine, Checkout, Webhook, Ledger, Split, OrderOrchestrator,
BusinessRulesEngine, NotificationCenter).

## Arquitetura

```
Pedido → OrderOrchestrator → DispatchEngine → DeliveryProvider → Driver → Tracking → Entrega
```

## Providers

Interface `DeliveryProvider` com implementações:

- **RestaurantDeliveryProvider** — entregas próprias do restaurante.
- **LocalixDeliveryProvider** — frota própria da plataforma (arquitetura pronta; app do entregador em fase futura).
- **ExternalDeliveryProvider** — stub para integrações Loggi / Lalamove / Uber Direct / Correios.

Registro em `providers/index.ts` via `getDeliveryProvider(id)` / `registerDeliveryProvider(p)`.

## Dispatch

`DispatchEngine.choose({ strategy, context, restaurantHasOwnFleet, drivers })` seleciona
o provider e o motorista conforme a estratégia:

- `AUTO` — RESTAURANT (se frota própria) → LOCALIX
- `RESTAURANT` / `LOCALIX` / `EXTERNAL` — força a estratégia
- `HYBRID` — tenta na ordem RESTAURANT → LOCALIX → EXTERNAL

## State Machine

Estados: `WAITING_ASSIGNMENT`, `ASSIGNED`, `GOING_TO_RESTAURANT`, `WAITING_PICKUP`,
`PICKED_UP`, `ON_THE_WAY`, `ARRIVED`, `DELIVERED`, `FAILED`, `RETURNED`, `CANCELLED`.

Transições ilegais lançam erro. Estados terminais: `DELIVERED`, `CANCELLED`, `RETURNED`.

## Eventos

`DeliveryEventBus` publica: `DriverAssigned`, `DriverChanged`, `DriverArrived`,
`PickupStarted`, `OrderPickedUp`, `DeliveryStarted`, `DriverNearCustomer`,
`OrderDelivered`, `DeliveryCancelled`, `DeliveryFailed`.

## Tracking e ETA

- `TrackingService.updateLocation(driverId, point)` — histórico + distância + ETA.
- `ETAEngine.calculateETA({ distance_km, avg_speed_kmh, prep_minutes, wait_minutes, delivery_minutes })`.
- `haversineKm(a, b)` — distância entre dois pontos.

## Assignment

`AssignmentEngine.rankDrivers` / `pickBestDriver` — considera distância, disponibilidade,
avaliação, carga atual e área de atendimento.

## Business Rules

`rules/delivery-business-rules.ts` — regras plugáveis no `BusinessRulesEngine`
(peso máximo, capacidade). O motor não é ativado automaticamente; registrar
via `registry.register(...)` quando desejado.

## Integração com OrderOrchestrator

Transições relevantes (a integrar em fase futura):
`READY → OUT_FOR_DELIVERY → DELIVERED → COMPLETED`. Sempre passar pelo
`OrderOrchestrator.transition(...)`.

## Integração com NotificationCenter

`NotificationCenter` já ouve os eventos do `deliveryEventBus` quando o bridge é
registrado — mapear `OrderPickedUp`, `DeliveryStarted`, `DriverNearCustomer`,
`OrderDelivered` para os templates existentes.

## Tabelas

- `delivery_orders`, `drivers`, `driver_locations`, `delivery_timeline`.

## Como criar novos Delivery Providers

1. Implementar `DeliveryProvider` (`createDelivery`, `assignDriver`, `cancelDelivery`, `track`, `estimate`, `health`).
2. Chamar `registerDeliveryProvider(new MyProvider())`.
3. Se necessário, adicionar novo `DeliveryProviderId` em `types.ts`.

## Testes

`DeliveryEngine.test.ts` cobre: state machine, ETA, tracking, ranking, dispatch,
criação/transição/cancelamento e mudança de motorista.

## Pendências para produção

- Repositório real (Supabase) para `DeliveryRepository`.
- App do entregador (Localix fleet).
- Integrações reais dos parceiros externos.
- Bridge `deliveryEventBus → NotificationCenter` ativado no bootstrap.
- Painéis de restaurante e admin com dados reais (placeholders criados).
