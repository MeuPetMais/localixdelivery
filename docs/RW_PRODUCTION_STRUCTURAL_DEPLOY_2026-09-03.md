# Localix Benefits + Rewards — Deploy estrutural em produção

Data: 2026-09-03
Ambiente: Localix Production (`mvkfrwxgneqzvoabkaws`)
Escopo autorizado: instalar estrutura Benefits + Rewards mantendo os dois kill switches OFF.

## Resultado

Deploy estrutural concluído com sucesso.

Migrations registradas em produção:

- `20260903194309 localix_benefits_rb1_foundation`
- `20260903194404 localix_benefits_rb1_transactions`
- `20260903194438 localix_rewards_rw1_core`
- `20260903194507 localix_rewards_rw11_refund_clawback`
- `20260903194526 localix_rewards_rw12_durable_order_queue`
- `20260903194546 localix_rewards_rw12_clawback_state_fix`
- `20260903194604 localix_rewards_rw13_operational_health`

## Estado final dos switches

- `localix_benefits_enabled = false`
- `localix_rewards_enabled = false`

## Estado financeiro / operacional após instalação

- benefit campaigns: 0
- benefit credits: 0
- reward programs: 0
- reward progress rows: 0
- reward progress events: 0
- reward queue rows: 0
- active Rewards workers: 1

Nenhum crédito foi concedido. Nenhum programa Rewards foi criado ou ativado.

## Health check

`rewards_operational_health()` retornou:

- `ok = true`
- `pending = 0`
- `retryable_failed = 0`
- `exhausted = 0`
- `clawback_pending = 0`
- `active_jobs = 1`
- `rewards_enabled = false`
- `benefits_enabled = false`

## Segurança

As RPCs críticas Benefits/Rewards verificadas ficaram:

- `SECURITY DEFINER`
- `search_path = public, pg_temp`
- `anon EXECUTE = false`
- `authenticated EXECUTE = false`
- `service_role EXECUTE = true`

Inclui:

- `benefits_grant`
- `benefits_reserve`
- `benefits_release`
- `benefits_redeem`
- `benefits_reverse`
- `benefits_release_expired`
- `benefits_revoke_unspent_grant`
- `rewards_process_completed_order`
- `rewards_reverse_order`
- `rewards_process_order_event_queue`
- `rewards_operational_health`
- `tg_rewards_enqueue_order_event`

## Coexistência com estoque

Os dois triggers críticos coexistem em `orders`:

- `tg_orders_stock_status_transition`: BEFORE UPDATE OF status
- `trg_rewards_enqueue_order_event`: AFTER INSERT OR UPDATE OF status

Como `localix_rewards_enabled=false`, o trigger de Rewards retorna sem enfileirar eventos.

## Advisor

O advisor de segurança não mostrou nova exposição específica das RPCs Benefits/Rewards. Permanecem débitos anteriores do projeto em outras funções `SECURITY DEFINER` e avisos informativos de tabelas RLS sem policies deliberadamente internas.

## Status

**DEPLOY ESTRUTURAL EM PRODUÇÃO: APROVADO**

**ATIVAÇÃO FUNCIONAL: NÃO REALIZADA**

Próximo gate: preparar campanha/programa piloto, smoke test controlado e ativação gradual dos kill switches.
