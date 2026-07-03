# Order Orchestrator

Camada central de orquestração do ciclo de vida dos pedidos do Localix.

> **Regra de ouro:** nenhum componente React, Edge Function ou serviço pode
> alterar o `status` de um pedido diretamente. Toda mudança deve passar por
> `OrderOrchestrator.transition()`.

## Módulos

| Arquivo | Responsabilidade |
| --- | --- |
| `OrderStateMachine.ts` | Estados e mapa de transições permitidas |
| `TransitionValidator.ts` | Valida transições (estado + ator) |
| `OrderPermissions.ts` | Define quem pode disparar cada transição |
| `OrderOrchestrator.ts` | Executa transições, grava histórico, publica eventos |
| `OrderTimelineService.ts` | Monta linha do tempo legível |
| `OrderAudit.ts` | Estrutura auditoria (IP, origem, usuário, serviço) |
| `domain-events.ts` | `OrderEventBus` + nomes de eventos de domínio |

## Estados

`CREATED → WAITING_PAYMENT → PAYMENT_APPROVED → RESTAURANT_ACCEPTED →
PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED → COMPLETED`

Estados terminais: `COMPLETED`, `CANCELLED`, `REFUNDED`, `CHARGEBACK`,
`RESTAURANT_REJECTED`.

Transições bloqueadas (exemplos):
- `DELIVERED → PREPARING`
- `CANCELLED → READY`
- `PAYMENT_FAILED → DELIVERED`

## Eventos publicados

`OrderCreated`, `OrderWaitingPayment`, `PaymentApproved`, `PaymentFailed`,
`RestaurantAccepted`, `RestaurantRejected`, `PreparingStarted`, `OrderReady`,
`DeliveryStarted`, `OrderDelivered`, `OrderCompleted`, `OrderCancelled`,
`OrderRefunded`, `ChargebackReceived`.

Todos publicados via `OrderEventBus` (arquivo `domain-events.ts`). Isolado
do `EventBus` de pagamentos para não interferir em consumidores existentes.

## Permissões

| Ator | Pode disparar |
| --- | --- |
| `customer` | `CREATED`, `CANCELLED` |
| `restaurant` | `RESTAURANT_ACCEPTED/REJECTED`, `PREPARING`, `READY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED` |
| `courier` | `OUT_FOR_DELIVERY`, `DELIVERED` |
| `webhook` | `PAYMENT_APPROVED/FAILED`, `REFUNDED`, `CHARGEBACK` |
| `system` | Transições automáticas do fluxo |
| `admin` | Todas |

## Uso

```ts
import { createOrchestrator } from "@/lib/orders/OrderOrchestrator";

const orchestrator = createOrchestrator({
  getOrder: async (id) => { /* SELECT id, restaurant_id, status */ },
  updateOrderStatus: async (id, next) => { /* UPDATE orders SET status=... */ },
  insertHistory: async (row) => { /* INSERT INTO order_status_history */ },
});

await orchestrator.transition({
  orderId,
  to: "PAYMENT_APPROVED",
  reason: "MP webhook payment.approved",
  audit: { actorType: "webhook", service: "mp-webhook", ip: req.ip },
});
```

## Como adicionar novos estados

1. Acrescentar em `OrderState` e `ORDER_STATES` (`OrderStateMachine.ts`).
2. Adicionar entradas em `ALLOWED_TRANSITIONS` (entrada e saída).
3. Mapear ator permitido em `PERMISSIONS` (`OrderPermissions.ts`).
4. Adicionar label em `OrderTimelineService.ts`.
5. Adicionar evento em `STATE_TO_EVENT` e `OrderDomainEventName`.
6. Adicionar testes cobrindo transições válidas/inválidas do novo estado.

## Como adicionar novas transições

Editar `ALLOWED_TRANSITIONS[from]` incluindo o novo destino, e garantir
que `PERMISSIONS[to]` contenha o ator responsável. Adicionar teste.

## Integrações (pendências para produção)

Este módulo foi entregue **sem alterar** WebhookService, SplitService,
FinancialLedger, PaymentIntent, PricingEngine, OrderService ou Checkout,
conforme requisito. Para ativá-lo end-to-end é necessário:

- WebhookService: em `payment.approved`, invocar
  `orchestrator.transition({ to: "PAYMENT_APPROVED", audit: { actorType: "webhook" } })`
  em vez de escrever `orders.status` diretamente.
- SplitService: subscrever `PaymentApproved` no `OrderEventBus` e iniciar
  split somente quando o pedido estiver em `PAYMENT_APPROVED`.
- FinancialLedger: consumir eventos do `OrderEventBus` para lançar
  entradas complementares às já existentes.
- Kitchen/Orders UI: chamar transições via server function (a criar) em vez
  de `UPDATE orders`.

## Testes

`OrderOrchestrator.test.ts` cobre:

- Transições válidas do fluxo canônico
- Bloqueio de transições inválidas
- Bloqueio por ator sem permissão
- Registro de histórico + publicação de eventos
- Pedido inexistente
- Integração com `OrderEventBus`
- Timeline (ordenação + labels)

## Relatório de entrega

**Arquivos criados**
- `supabase/migrations/*_order_status_history.sql` (migração)
- `src/lib/orders/OrderStateMachine.ts`
- `src/lib/orders/TransitionValidator.ts`
- `src/lib/orders/OrderPermissions.ts`
- `src/lib/orders/domain-events.ts`
- `src/lib/orders/OrderAudit.ts`
- `src/lib/orders/OrderOrchestrator.ts`
- `src/lib/orders/OrderTimelineService.ts`
- `src/lib/orders/OrderOrchestrator.test.ts`
- `src/lib/orders/OrderOrchestrator.README.md`

**Serviços criados**
`OrderOrchestrator`, `TransitionValidator`, `OrderStateMachine`,
`OrderPermissions`, `OrderTimelineService`, `OrderAudit`, `OrderEventBus`.

**Eventos publicados**
14 eventos de domínio (ver seção Eventos).

**Pendências para produção**
Ver seção Integrações. Nenhum módulo existente foi alterado — as
integrações devem ser feitas em prompts subsequentes, mantendo
compatibilidade e cobertura de testes por módulo.
