# RW-1.3 — Localix Rewards Operational Readiness

**Data:** 03/09/2026  
**Ambiente validado:** staging `dnotmvbhuqujvqdtgzav`  
**Produção:** não alterada.

## Objetivo
Fornecer um sinal server-side mínimo e verificável para a operação de Rewards antes de produção, sem criar uma segunda infraestrutura de incidentes ou alertas.

## Health check
RPC privilegiada: `rewards_operational_health()`.

Retorna:
- estado dos kill switches Rewards/Benefits;
- fila PENDING;
- FAILED ainda retryable;
- FAILED com tentativas esgotadas;
- idade do evento acionável mais antigo;
- processados na última hora e nas últimas 24h;
- quantidade de `CLAWBACK_PENDING`;
- quantidade de jobs ativos `localix-rewards-order-events`.

`ok=false` quando:
- existe evento com tentativas esgotadas; ou
- não existe exatamente um worker cron ativo.

`CLAWBACK_PENDING` é exposto separadamente porque exige análise operacional/financeira; sua presença não autoriza reversão automática adicional.

## Segurança
- `SECURITY DEFINER`;
- `search_path=public, pg_temp`;
- `anon`: sem EXECUTE;
- `authenticated`: sem EXECUTE;
- `service_role`: EXECUTE.

## Evidência staging
Estado normal após cleanup:
- `ok=true`;
- pending=0;
- retryable_failed=0;
- exhausted=0;
- clawback_pending=0;
- active_jobs=1;
- `localix_rewards_enabled=false`;
- `localix_benefits_enabled=false`.

Teste sintético em transação com rollback criou um evento `FAILED` com `attempts=max_attempts=10`.
Resultado esperado e observado:
- exhausted=1;
- `ok=false`.
Após rollback não permaneceu artefato de teste.

## Procedimento operacional
### Antes de ativar Rewards
1. Confirmar migrations Benefits + Rewards + clawback + durable queue + health aplicadas.
2. Executar `rewards_operational_health()`.
3. Exigir `worker.active_jobs=1`, `queue.exhausted=0` e nenhuma fila antiga inesperada.
4. Manter `localix_benefits_enabled=false` e `localix_rewards_enabled=false` durante deploy/migrations.
5. Ativar somente dentro de janela controlada após smoke test server-side.

### Se `queue.retryable_failed > 0`
- ler `last_error`, `attempts`, `available_at` e `order_id` na fila;
- corrigir a causa raiz;
- não editar saldo/ledger manualmente;
- permitir retry normal quando ainda abaixo de `max_attempts`.

### Se `queue.exhausted > 0`
- considerar incidente operacional;
- não resetar `attempts` automaticamente;
- identificar pedido, erro e efeito financeiro já ocorrido antes de qualquer reprocessamento;
- criar ação de correção/replay somente após confirmar idempotência e estado financeiro.

### Se `clawback_pending > 0`
- recompensa reservada/resgatada não deve ser alterada automaticamente;
- revisar pedido, crédito, reserva/resgate e motivo do refund/chargeback;
- nenhuma resolução financeira manual está autorizada por este runbook.

## Rollback / contenção
Primeira contenção: desligar `localix_rewards_enabled` para impedir novos eventos Rewards.
Quando o risco envolver a infraestrutura econômica, desligar também `localix_benefits_enabled`.
Não remover migrations nem apagar ledger como rollback.
O cron pode permanecer ativo para observabilidade; com Rewards desligado, o trigger não cria novos eventos.

## Critério para produção
Antes de produção, exigir:
- RB-1, RW-1, RW-1.1, RW-1.2 e RW-1.3 verdes em staging;
- produção ainda com switches OFF durante aplicação das migrations;
- health check saudável após deploy;
- smoke test controlado;
- política operacional explícita para `CLAWBACK_PENDING`;
- rollback por kill switch validado.

## Pendência consciente
Não existe nesta fase um canal automático de alerta (Slack/e-mail/incidente persistido) já comprovado e reutilizável no projeto. Portanto o health check é a fonte operacional mínima, mas não substitui futura automação de alertas.