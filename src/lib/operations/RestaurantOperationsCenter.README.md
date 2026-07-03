# Restaurant Operations Center

Central operacional em tempo real do Localix. Toda mudança de status passa
**exclusivamente** por `OrderOrchestrator.transition()` — este módulo nunca
altera pedidos diretamente.

## Fluxo

```
Restaurant Dashboard
      └── OperationsCenter
            ├── OrdersBoard (Kanban)
            ├── KitchenDisplay (KDS)
            ├── DeliveryPanel
            └── LiveTimeline
```

## Componentes

- `OperationsCenter` — tela principal (tabs orders/kitchen/delivery/timeline, counters, alertas, quick actions).
- `OrdersBoard` — Kanban com 9 colunas (Novos, Aguardando pagamento, Pagos, Aceitos, Em preparo, Prontos, Em entrega, Finalizados, Cancelados). Cada card mostra número, cliente, itens, valor, pagamento, tempo, entrega e prioridade.
- `KitchenDisplay` — KDS otimizada: itens, observações, cronômetro, iniciar/finalizar preparo.
- `DeliveryPanel` — entregador, status, ETA, provider, timeline, placeholder de mapa.
- `LiveTimeline` — consome `OrderTimelineService.build(history)`.
- `LiveCounters` / `OperationalMetricsView` / `OperationalAlerts` — contadores, métricas e alertas.
- `OperationsQuickActions` — Aceitar/Recusar/Iniciar/Finalizar/Despachar/Cancelar.

## Serviços (`src/lib/operations`)

| Arquivo | Responsabilidade |
| --- | --- |
| `OperationsService` | Fachada. `perform()` valida permissão, chama `OrderOrchestrator.transition()` e emite audit + sons. |
| `OperationsPermissions` | Matriz `role × action` e mapa `action → OrderState`. |
| `columns` | Colunas do Kanban e `columnForState()`. |
| `PriorityEngine` | Classifica URGENT/NORMAL/LOW por idade, ETA e VIP. |
| `AlertsEngine` | Alertas: atrasado, pagamento pendente, entregador atrasado, restaurante fechado. |
| `OperationsMetrics` | Counters (novos, preparo, entrega, hoje) e métricas (tempos, cancel, pedidos/h). |
| `OperationsFilters` | Filtros por hoje/pendentes/entrega/pagamento/prioridade/cliente/busca. |
| `OperationsRealtime` | Bridge `OrderEventBus.subscribe(...)` → listener local. |
| `KitchenSounds` | Infra de sons (`NEW_ORDER`, `ORDER_READY`, `ORDER_CANCELLED`). Sem áudio real. |

## Integração `OrderOrchestrator`

```ts
import { createOperationsService } from "@/lib/operations";
import { createOrchestrator } from "@/lib/orders/OrderOrchestrator";

const orchestrator = createOrchestrator({ /* deps de I/O */ });
const ops = createOperationsService({ orchestrator, audit: async (r) => { /* persist */ } });

await ops.perform({ action: "ACCEPT", orderId, role: "ATTENDANT", actorId: userId });
```

Mapa de ações → estados:
`ACCEPT→RESTAURANT_ACCEPTED`, `REJECT→RESTAURANT_REJECTED`,
`START_PREP→PREPARING`, `FINISH_PREP→READY`, `DISPATCH→OUT_FOR_DELIVERY`,
`MARK_DELIVERED→DELIVERED`, `CANCEL→CANCELLED`.

## Permissões

| Ação | ADMIN | MANAGER | ATTENDANT | CASHIER | KITCHEN |
| --- | :-: | :-: | :-: | :-: | :-: |
| Accept/Reject | ✓ | ✓ | ✓ | | |
| Start/Finish Prep | ✓ | ✓ | | | ✓ |
| Dispatch/Delivered | ✓ | ✓ | ✓ | | |
| Cancel | ✓ | ✓ | | | |

## Realtime

`OperationsRealtime.subscribe(listener)` inscreve no `OrderEventBus`; toda
transição publicada pelo orchestrator dispara refresh incremental. Sem
polling, sem F5.

## Fullscreen / Modo cozinha

`OperationsCenter` aceita `fullscreenMode: "kitchen" | "attendant" | "off"`
para iniciar em uma aba específica. UI de fullscreen do browser fica a
cargo do container.

## Auditoria

`OperationsService.perform()` grava `{ action, orderId, actorId, role, at, origin: "OPERATIONS_CENTER" }`
via callback `audit` injetável (nada persistido por padrão).

## Testes

`src/lib/operations/OperationsService.test.ts` cobre: prioridades, alertas,
counters/métricas, filtros, matriz de permissão, delegação ao orchestrator,
buildBoard, sons e bridge realtime (11 cenários).

## Pendências para a próxima etapa

- Ligar `cards` e `timeline` aos data providers reais (OrderService + OrderTimelineService).
- Persistir `OperationsAuditRecord` via sink existente.
- Integrar `OperationalAlerts` ao `NotificationCenter` para notificações push.
- Mapa real no `DeliveryPanel` (consumir `TrackingService` do DeliveryEngine).
- Implementar player de áudio para `KitchenSounds.onPlay(...)`.
- Virtualização (`react-window`) quando o Kanban ultrapassar centenas de cards.
