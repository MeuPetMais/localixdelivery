# Loyalty Lifecycle

## Ciclo de vida dos pontos

```
EARN → (uso) REDEEM → REDEEM commit/rollback → EXPIRE (após validity_days)
                                     │
                                     └── PointsExpiring (30 / 7 / 1 dia antes)
```

## Componentes

- **RPC `loyalty_expire_points()`** — expira EARN mais antigos que
  `restaurants.loyalty_settings.validity_days`. Idempotente por dia.
- **RPC `loyalty_scan_expiring()`** — para cada saldo > 0 em programa ativo,
  gera eventos `PointsExpiring` nas janelas de 30, 7 e 1 dia. Deduplicado
  por `(customer_id, restaurant_id, event_type, dedupe_key)`.
- **Tabela `loyalty_events`** — fila preparada para o NotificationCenter.
  Nada é enviado ainda; apenas publicado. RLS: dono lê os do seu restaurante,
  cliente lê os seus.
- **Cron `loyalty-daily-lifecycle`** — pg_cron 03:00 diário:
  `SELECT loyalty_expire_points(); SELECT loyalty_scan_expiring();`.

## Eventos

| Tipo | Payload |
|------|---------|
| PointsExpiring | `{ points, days, expire_at }` — `days ∈ {30,7,1}` |

## Superfícies

- **Cliente `/fidelidade`** — banner "⚠ N pontos expiram em X dias" via
  `getMyExpiringPoints`.
- **Restaurante `/programa-fidelidade`** — KPIs Pontos emitidos / resgatados
  / expirados / descontos e Analytics (ativos, sem resgate, com pontos
  expirando, taxa de utilização, taxa de expiração) via
  `getRestaurantLoyaltyAnalytics`.

## Garantias

- Idempotência: unique index `uq_loyalty_events_dedupe` e
  `uq_loyalty_tx_order_source` na tabela de transações.
- Rollback: cancelamento de pedido chama `loyalty_rollback_reserve` /
  gatilho `tg_orders_loyalty_status` (source `cancel_reverse`).
- Reprocessamento seguro: o cron pode rodar N vezes/dia sem gerar duplicados.
