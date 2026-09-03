# RW-1.2 — Localix Rewards Durable Order Events — Staging Validation

**Data:** 03/09/2026  
**Ambiente:** Supabase staging `dnotmvbhuqujvqdtgzav`  
**Produção:** não alterada.

## Objetivo
Eliminar a dependência do EventBus in-process para efeitos financeiros de Rewards, mantendo a transição do pedido desacoplada da concessão/reversão de crédito.

## Arquitetura validada
`orders.status` → trigger leve → `reward_order_event_queue` → worker transacional → `rewards_process_completed_order` / `rewards_reverse_order` → Localix Benefits.

O trigger apenas persiste o evento. O efeito financeiro ocorre no worker.

## Eventos duráveis
- `concluido` → `ORDER_COMPLETED`
- `reembolsado` → `ORDER_REFUNDED`
- `chargeback` → `ORDER_CHARGEBACK`
- `cancelado` → `ORDER_CANCELLED`

Unicidade: `(order_id,event_type)`.

## Worker
`rewards_process_order_event_queue(limit)` usa:
- `FOR UPDATE SKIP LOCKED`;
- status `PENDING/FAILED/PROCESSED`;
- `attempts` persistente;
- `max_attempts=10`;
- backoff após falha;
- RPCs de Rewards/Benefits já idempotentes;
- execução somente por `service_role`.

Cron de staging: `localix-rewards-order-events`, `* * * * *`, lote 50.

## Evidências E2E
### Conclusão e refund
1. pedido criado como `novo`;
2. mudança para `concluido` criou `ORDER_COMPLETED` PENDING;
3. worker processou e criou progresso/recompensa;
4. mudança para `reembolsado` criou `ORDER_REFUNDED`;
5. o próprio pg_cron processou a reversão antes da chamada manual, provando execução operacional independente;
6. crédito não utilizado foi integralmente revogado.

### Defeito encontrado e corrigido — estado após clawback automático
A primeira implementação revogava corretamente o crédito, mas deixava o progresso em `REVIEW_REQUIRED`.

Correção: quando o crédito ainda está integralmente disponível e a revogação é automática e segura, o ciclo volta para:
- `status=IN_PROGRESS`;
- `qualified_orders` reduzido;
- `goal_reached_at=null`;
- `reward_granted_at=null`;
- `reward_credit_id=null`.

Reteste: `qualified_orders=0`, `status=IN_PROGRESS`, `reward_credit_id=null`, `available=0`, `revoked=5`.

Crédito reservado ou já resgatado continua em `REVIEW_REQUIRED + CLAWBACK_PENDING`; esses dois cenários foram testados separadamente no RW-1.1 e o saldo em uso permaneceu intacto.

### Defeito encontrado e corrigido — attempts não persistia
Com Benefits desligado, o worker registrou `FAILED/BENEFITS_DISABLED`, porém `attempts` permaneceu 0 porque o incremento estava dentro de um bloco PL/pgSQL revertido pelo `EXCEPTION`.

Correção: incrementar e persistir `attempts` antes do bloco interno que captura a falha.

Reteste:
- tentativa com Benefits OFF → `FAILED`, `attempts=1`, `last_error=BENEFITS_DISABLED`;
- Benefits ON + retry → `PROCESSED`, `attempts=2`, exatamente 1 crédito.

### Concorrência de workers
Dois jobs pg_cron independentes executaram `rewards_process_order_event_queue(1)` praticamente ao mesmo tempo contra um único evento pendente.

Inícios observados:
- job 12: `2026-09-03 17:36:00.040666+00`
- job 11: `2026-09-03 17:36:00.044549+00`

Ambos concluíram sem erro. Resultado final do evento:
- `status=PROCESSED`;
- `attempts=1`;
- `qualified_events=1`;
- `reward_credits=1`.

Conclusão: `SKIP LOCKED` impediu processamento concorrente duplicado no cenário testado.

## Segurança
- queue com RLS;
- nenhum acesso direto para `public`, `anon` ou `authenticated`;
- worker SECURITY DEFINER com `search_path=public, pg_temp`;
- EXECUTE do worker apenas `service_role`;
- advisor não apontou as novas funções Rewards como executáveis por anon/authenticated;
- `rls_enabled_no_policy` na queue é intencional: deny-all para clientes, com acesso privilegiado pelo worker.

Avisos antigos do projeto (Loyalty, Delivery, Support, mutable search_path, pg_net etc.) continuam fora do escopo deste gate.

## Cleanup e estado final
Todos os pedidos, campanhas, programas, créditos, ledger, eventos e jobs temporários de teste foram removidos.

Jobs temporários de concorrência foram removidos; o job operacional normal foi restaurado.

Kill switches ao final:
- `localix_rewards_enabled=false`
- `localix_benefits_enabled=false`

## Produção
Verificação read-only confirmou ausência em produção de:
- `reward_order_event_queue`;
- `tg_rewards_enqueue_order_event`;
- `rewards_process_order_event_queue`;
- cron `localix-rewards-order-events`.

## Gate
**RW-1.2 — integração durável de eventos de pedido em staging: APROVADA.**

Pendências antes de produção:
- observabilidade/alerta para filas FAILED que atinjam `max_attempts`;
- procedimento operacional para `CLAWBACK_PENDING`;
- gate consolidado de deploy Benefits + Rewards com kill switches OFF.