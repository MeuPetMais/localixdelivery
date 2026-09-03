# RW-1 — Localix Rewards Core — Validação de Staging

**Data:** 03/09/2026  
**Ambiente:** Supabase Staging (`dnotmvbhuqujvqdtgzav`)  
**Produção:** não alterada.

## Escopo validado

RW-1 implementa somente a camada de mérito/progresso:

`OrderCompleted -> Rewards progress -> Goal reached -> benefits_grant`

Não altera Checkout, PricingEngine, PaymentService, Mercado Pago, split ou webhook.

## Objetos criados

- `platform_settings.localix_rewards_enabled` — kill switch, default OFF.
- `reward_programs`
- `customer_reward_progress`
- `reward_progress_events`
- RPC `rewards_process_completed_order(uuid,jsonb)`

## Segurança

- RLS habilitado nas três tabelas.
- Cliente autenticado pode ler somente seu próprio progresso/eventos.
- `reward_programs` permanece deny-all para acesso direto do cliente nesta fase.
- A RPC é `SECURITY DEFINER` com `search_path = public, pg_temp`.
- `anon`: sem EXECUTE.
- `authenticated`: sem EXECUTE.
- `service_role`: EXECUTE permitido.

Resultado dos testes negativos/segurança:

`RW1_NEGATIVE_SECURITY_PASS`

Casos validados:
- kill switch desligado -> `REWARDS_DISABLED`;
- pedido não concluído -> `ORDER_NOT_COMPLETED`;
- pedido sem consumidor autenticado -> `CUSTOMER_AUTH_REQUIRED`;
- fronteira de EXECUTE por role.

## Fluxo funcional

Programa artificial:
- 3 pedidos concluídos por ciclo;
- 2 ciclos máximos;
- benefício econômico de R$ 5 por ciclo via Localix Benefits.

Foram processados 6 pedidos artificiais dentro de transação com rollback.

Resultado:
- 2 ciclos de progresso;
- 3 pedidos qualificados em cada ciclo;
- 6 eventos `ORDER_QUALIFIED`;
- 2 eventos `REWARD_GRANTED`;
- 2 créditos no Localix Benefits;
- replay do sexto pedido: 0 novo progresso e 0 novo grant.

Resultado explícito:

`RW1_CORE_FLOW_PASS`

## Concorrência — falha encontrada e corrigida

O primeiro teste com duas sessões PostgreSQL independentes processando o mesmo `OrderCompleted` simultaneamente encontrou uma falha operacional: ambas tentaram criar o mesmo `(program_id, customer_id, cycle)` e uma delas recebeu unique violation.

Não houve concessão financeira duplicada, mas o comportamento não era robustamente idempotente.

### Causa raiz

Criação concorrente da primeira linha de `customer_reward_progress` após ambas as transações observarem ausência de progresso prévio.

### Correção

A criação de progresso passou a convergir com:

`INSERT ... ON CONFLICT(program_id, customer_id, cycle) DO UPDATE ... RETURNING`

A transição `IN_PROGRESS -> GOAL_REACHED` também passou a ser condicional, garantindo que apenas a sessão vencedora execute o grant.

### Reteste real

Duas conexões independentes via `pg_cron` processaram o mesmo pedido/programa/cliente.

Inícios registrados:
- sessão A: `2026-09-03 17:05:00.014499+00`
- sessão B: `2026-09-03 17:05:00.015714+00`

Ambas finalizaram com sucesso.

Estado final antes da limpeza:
- `progress_rows = 1`
- `qualified_events = 1`
- `reward_events = 1`
- `credits = 1`
- `qualified_orders = 1`

Conclusão: o cenário testado de evento duplicado concorrente não criou progresso, qualificação ou crédito duplicado.

## Performance advisor

O advisor inicialmente apontou cinco FKs do novo Rewards sem índice de suporte:
- `customer_reward_progress.reward_credit_id`
- `reward_programs.benefit_campaign_id`
- `reward_programs.restaurant_id`
- `reward_progress_events.order_id`
- `reward_progress_events.progress_id`

Foram adicionados os índices correspondentes. No advisor subsequente, esses avisos de FK sem índice não apareceram mais.

Os novos índices podem aparecer temporariamente como `unused_index` porque o staging foi limpo após os testes; isso não justifica removê-los.

## Cleanup e estado operacional

Após os testes:
- jobs `pg_cron` artificiais removidos;
- programas/campanhas/pedidos artificiais removidos ou revertidos;
- `localix_rewards_enabled = false`;
- `localix_benefits_enabled = false`.

## Pendências antes de produção

RW-1 Core valida somente o caminho positivo e idempotente. Ainda são gates obrigatórios:

1. política e implementação para `refund`/`chargeback` após qualificação ou concessão;
2. mecanismo durável de integração do estado `concluido` com `rewards_process_completed_order` — o EventBus JavaScript em memória não é evidência suficiente para evento financeiro;
3. testes integrados do caminho de reversão;
4. implantação controlada da fundação Benefits e Rewards em produção somente após os gates acima.

A infraestrutura existente `benefits_reverse` não deve ser reutilizada indevidamente para simplesmente cancelar um grant ainda não consumido; esse caso precisa de semântica própria e auditável.

## Gate

**RW-1 — Localix Rewards Core em staging: APROVADO para o caminho positivo.**

**Produção: NÃO LIBERADA.**
