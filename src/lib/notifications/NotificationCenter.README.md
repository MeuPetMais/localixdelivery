# Notification Center

Infraestrutura centralizada de notificações do Localix. **Nenhum módulo envia
notificações diretamente** — todos passam pelo `NotificationCenter`.

## Arquitetura

```
EventBus (payments) ─┐
OrderEventBus ───────┼──► events.ts (bridge) ──► NotificationCenter
Módulos internos ────┘                                │
                                                     ▼
                                          NotificationPreferenceService
                                                     │
                                                     ▼
                                            NotificationQueue (tabela notifications)
                                                     │
                                                     ▼
                                            NotificationDispatcher
                                                ├── TemplateEngine
                                                ├── ChannelProvider
                                                └── AuditService (notification_logs)
```

## Fluxo

1. Módulo (ou bridge de evento) chama `NotificationCenter.notify(req)`.
2. `NotificationPreferenceService` valida canal, marketing e quiet hours.
3. Se permitido, insere na tabela `notifications` (status `PENDING`).
4. Worker/cron (prompt futuro) chama `NotificationDispatcher.dispatch()`.
5. Dispatcher renderiza via `TemplateEngine`, envia via `ChannelProvider`,
   registra em `notification_logs`.
6. Falha → `RetryEngine` calcula próxima tentativa ou envia para `DEAD_LETTER`.

## Tabelas

- `notification_templates` — templates versionados por `(code, channel, language)`.
- `notification_preferences` — 1 linha por `user_id`.
- `notifications` — fila (status PENDING → PROCESSING → SENT / FAILED / RETRY / DEAD_LETTER).
- `notification_logs` — append-only, 1 linha por tentativa.

## Providers

| Canal      | Status         |
|------------|----------------|
| IN_APP     | ✅ implementado |
| PUSH       | preparado      |
| EMAIL      | preparado      |
| SMS        | preparado      |
| WHATSAPP   | preparado      |
| WEBSOCKET  | preparado      |

Todos implementam `NotificationProvider` (`send`, `validate`, `health`).

## Templates iniciais

`ORDER_CREATED`, `ORDER_ACCEPTED`, `ORDER_REJECTED`, `PAYMENT_APPROVED`,
`PAYMENT_FAILED`, `PAYMENT_EXPIRED`, `ORDER_PREPARING`, `ORDER_READY`,
`OUT_FOR_DELIVERY`, `ORDER_DELIVERED`, `ORDER_CANCELLED`, `REFUND_CREATED`,
`WELCOME`, `PASSWORD_RESET`.

Sintaxe: `{{ variavel }}` (suporta `{{ obj.campo }}`).

## Como adicionar um novo canal

1. Crie `src/lib/notifications/providers/MeuProvider.ts` implementando `NotificationProvider`.
2. Registre em `providers/index.ts` no `REGISTRY`.
3. Adicione a coluna ao ENUM `notification_channel` via migration.
4. Adicione flag em `notification_preferences` se aplicável.

## Como criar um novo template

Inserir linha em `notification_templates` (via migration ou painel admin):

```sql
INSERT INTO public.notification_templates (code, name, channel, language, title, body, variables_json)
VALUES ('MEU_CODE', 'Nome', 'IN_APP', 'pt-BR', 'Título {{x}}', 'Corpo {{x}}', '["x"]');
```

## Integração com EventBus

`bindNotificationCenterToBuses(enqueue)` inscreve o Center no
`OrderEventBus` e no `EventBus` de pagamentos. Consome (mapeamento em
`events.ts`): `OrderCreated`, `RestaurantAccepted`, `RestaurantRejected`,
`PreparingStarted`, `OrderReady`, `DeliveryStarted`, `OrderDelivered`,
`OrderCancelled`, `OrderRefunded`, `PaymentApproved`, `PaymentRejected`,
`PaymentExpired`, `PaymentRefunded`, `SplitCompleted`.

## Pendências para produção

- Worker/cron que consuma `notifications` PENDING e chame o dispatcher.
- Implementação real dos providers PUSH/EMAIL/SMS/WHATSAPP/WEBSOCKET.
- Painel admin (fila, erros, templates, últimos envios).
- Migração das notificações existentes (`customer_notifications`) para a nova
  tabela, se desejado.
