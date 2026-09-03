# RW-REL-01 — Plano controlado de release Benefits + Rewards

Data: 2026-09-03
Status: PRONTO PARA AUTORIZAÇÃO DE DEPLOY
Produção alterada por este documento: NÃO

## Objetivo

Instalar a infraestrutura Localix Benefits + Localix Rewards em produção sem ativar concessão de benefícios durante a instalação. Ambos os kill switches permanecem OFF até os gates técnicos e o smoke test controlado serem aprovados.

## Premissas verificadas em produção

- `pg_cron` instalado;
- `platform_settings` existe;
- `customer_profiles` existe;
- `orders` existe;
- `order_pricing_snapshot` existe;
- nenhuma das RPCs/tabelas Rewards/Benefits alvo colide com objeto existente;
- as mudanças recentes de Delivery/Stock já estão implantadas em produção;
- RW-PROD-01 revalidou Rewards contra essas mudanças no staging reconciliado.

## Migrations de instalação

Executar somente as migrations novas de Benefits/Rewards, nesta ordem:

1. `20260903170000_localix_benefits_rb1_foundation.sql`
2. `20260903170100_localix_benefits_rb1_transactions.sql`
3. `20260903171000_localix_rewards_rw1_core.sql`
4. `20260903183000_localix_rewards_rw11_refund_clawback.sql`
5. `20260903183100_localix_rewards_rw12_durable_order_queue.sql`
6. `20260903183200_localix_rewards_rw12_clawback_state_fix.sql`
7. `20260903184000_localix_rewards_rw13_operational_health.sql`

Não reaplicar migrations antigas de Delivery/Stock. Produção já possui o estado equivalente validado no RW-PROD-01.

## Gate 0 — antes de qualquer DDL

Confirmar novamente imediatamente antes do deploy:

- projeto alvo = `Localix Production` (`mvkfrwxgneqzvoabkaws`);
- banco `ACTIVE_HEALTHY`;
- migrations Rewards/Benefits ainda ausentes;
- `pg_cron` disponível;
- nenhuma campanha Rewards/Benefits criada;
- estado de Checkout/Pagamentos saudável;
- nenhuma migration concorrente em execução.

Se qualquer item divergir: STOP.

## Gate 1 — instalação com switches OFF

A migration de fundação deve criar:

- `platform_settings.localix_benefits_enabled = false`;
- tabelas Benefits;
- RLS e grants mínimos.

A migration Rewards deve criar:

- `platform_settings.localix_rewards_enabled = false`;
- tabelas de programa/progresso/eventos;
- fila durável;
- trigger de enqueue;
- cron worker;
- health check.

Mesmo com o cron ativo, `localix_rewards_enabled=false` impede novos eventos Rewards de serem enfileirados pelo trigger.

Após cada migration, em caso de erro: interromper. Não avançar parcialmente sem diagnosticar o objeto que falhou.

## Gate 2 — segurança e invariantes

Validar após instalação:

### Benefits

- RLS habilitado em todas as tabelas financeiras;
- ledger append-only;
- `benefits_*` financeiras não executáveis por `anon` nem `authenticated`;
- `service_role` executa as RPCs necessárias;
- `SECURITY DEFINER` com `search_path` explícito.

### Rewards

- fila não mutável diretamente por `anon/authenticated`;
- RPCs de processamento/reversão/health sem EXECUTE público;
- trigger helper sem EXECUTE público;
- `reward_progress_events` append-only;
- índices de idempotência presentes.

### Financeiro

Conferir constraints:

- conservação do crédito incluindo `revoked_amount`;
- `budget_committed <= budget_total`;
- `budget_redeemed <= budget_committed`;
- reserva não pode exceder saldo disponível.

## Gate 3 — estado operacional imediatamente após instalação

Esperado, ainda sem campanha:

- `localix_benefits_enabled=false`;
- `localix_rewards_enabled=false`;
- `rewards_operational_health().ok=true`;
- pending=0;
- retryable_failed=0;
- exhausted=0;
- clawback_pending=0;
- worker.active_jobs=1;
- nenhuma linha em `customer_benefit_credits` criada pelo deploy;
- nenhuma linha em `reward_progress_events` criada pelo deploy.

Se aparecer crédito/progresso espontâneo: STOP e investigar antes de qualquer ativação.

## Gate 4 — smoke test técnico com switches ainda OFF

Sem criar benefício financeiro real para cliente de produção:

- provar que funções/constraints existem;
- provar que anon/authenticated não chamam RPCs financeiras;
- provar que cron está registrado uma única vez;
- provar que trigger não enfileira eventos enquanto Rewards está OFF;
- rodar health check.

Não alterar pedido real para testar o trigger.

## Gate 5 — campanha piloto controlada

Somente após autorização separada de ativação:

1. criar uma campanha de teste com orçamento pequeno e explícito;
2. criar um programa Rewards restrito a um parceiro/control group definido;
3. manter `max_grants_per_customer` baixo;
4. definir valor do crédito e mínimo de pedido;
5. habilitar Benefits;
6. habilitar Rewards;
7. executar um pedido controlado real até `concluido`;
8. observar fila → progresso → grant;
9. reconciliar `customer_benefit_credits`, ledger, campanha e pedido;
10. executar cenário de reversão controlado somente se operacionalmente seguro.

Ativação geral não faz parte deste gate.

## Monitoramento inicial

Durante o piloto, acompanhar em cada janela operacional:

- `rewards_operational_health()`;
- `exhausted > 0`;
- `retryable_failed > 0` persistente;
- `clawback_pending > 0`;
- idade do evento acionável mais antigo;
- grants por campanha;
- orçamento comprometido e resgatado;
- créditos disponíveis/reservados/resgatados/revogados;
- duplicidade por idempotency keys;
- número de pedidos qualificados e recompensas concedidas.

## Rollback operacional

Primeira resposta a incidente:

1. `localix_rewards_enabled=false` — interrompe novos eventos Rewards;
2. se necessário, `localix_benefits_enabled=false` — interrompe novas mutações Benefits dependentes do switch;
3. não apagar ledger;
4. não editar saldo manualmente;
5. preservar fila/eventos para auditoria;
6. corrigir causa raiz;
7. reprocessar somente por caminho idempotente aprovado.

O rollback primário é por kill switch, não por DROP de tabelas/migrations.

## Critérios de abortar o piloto

- crédito duplicado;
- budget ultrapassado;
- saldo divergente da conservação;
- fila com `exhausted > 0` sem causa conhecida;
- clawback inesperado;
- Rewards interferindo em transição de pedido;
- impacto em estoque, PaymentService, PricingEngine, Mercado Pago ou webhook;
- health check vermelho sem explicação operacional.

## Impacto esperado

Checkout: nenhum durante instalação; uso de crédito no checkout permanece gate posterior.
Pedidos: trigger leve somente, protegido por switch.
OrderService: sem alteração nesta instalação.
PricingEngine: sem alteração.
PaymentService/Mercado Pago: sem alteração.
Supabase/DB: alto impacto estrutural, controlado por migrations/RLS/RPCs.
Localix Benefits: instalado, OFF.
Localix Rewards: instalado, OFF.
Parceiros/Clientes: sem UX nova até ativação/configuração posterior.
Entregadores/Estoque: nenhuma regra nova; compatibilidade já revalidada.
Admin: painel operacional dedicado ainda não é requisito para instalação; health/runbook são o controle inicial.

## Decisão de release

O pacote está tecnicamente preparado para uma instalação em produção com ambos os recursos OFF.

A execução em produção exige autorização explícita do responsável pelo projeto. Um simples avanço de documentação/preparação não deve ser interpretado como autorização para executar DDL no banco real.
