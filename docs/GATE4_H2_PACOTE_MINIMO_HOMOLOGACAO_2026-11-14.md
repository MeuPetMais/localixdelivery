# Gate 4 — H2: pacote mínimo por dependências reais / Supabase de homologação

Data: 2026-11-14. Ambiente exclusivo: `gvozcqyjhogmvebrwzap` (`localix-gate4-homologação`, sa-east-1). Branch: `integration/gate4-financial-issue90`, PR #100 Draft.

## Execução realizada, sem alteração no banco
- Consultas diretas via conexão específica `Homolocação localix`: projeto ACTIVE_HEALTHY, PostgreSQL 17.11, zero tabelas de aplicação em `public`, zero migrations, zero Edge Functions, zero policies de `public`.
- Executado `scripts/gate4-h2-financial-readiness.sql` (SELECT equivalente), retornando as **10 tabelas** e as **2 RPCs** ausentes. Este diagnóstico é *esperado* em banco novo; **H2 ainda não passou**.
- A fonte das definições vem do **repositório do PR #100**, não de um schema inventado.

## Dependências de código comprovadas

1. A migration original `supabase/migrations/20260914174138_atomic_checkout_order_creation.sql` cria `checkout_order_idempotency` com FK para `orders`, RLS + grants somente `service_role`; `create_order_with_snapshot_payment` insere atomicamente `orders`, `order_pricing_snapshot`, `order_payment` e linha de idempotência. Requer **colunas reais e constraints** dessas tabelas; também requer funções de status/numeração ligadas a `orders`.
2. A migration original `supabase/migrations/20260911160337_sync_orders_platform_fee_from_pricing_snapshot.sql` instala trigger que espelha a taxa do snapshot em `orders.platform_fee`/`fixed_fee`. Requer ambas as tabelas e colunas corretas. Não substitui cálculo autoritativo server-side.
3. A migration original `supabase/migrations/20260918165000_harden_payment_failed_ledger_idempotency.sql` exige `financial_ledger` com campos `provider`, `reference_type`, `reference_id`, `transaction_type`, `metadata jsonb`. Possui `DROP INDEX IF EXISTS`, portanto não se aplica antes da tabela e sem revisar cadeia anterior.
4. A migration `supabase/migrations/20261111204106_gate4_consistent_financial_snapshot.sql` cria `get_restaurant_financial_snapshot(uuid)` como `STABLE SECURITY INVOKER`, com `auth.uid()` e RLS real de `financial_ledger`. Sem uma tabela/roles/policies fiéis não há prova útil.
5. Os testes `supabase/functions/mp-webhook-retry/financial-flow.integration.test.ts` usam adaptadores simulados de `orders`, `order_payment`, `order_pricing_snapshot`, `restaurants`, `mercado_pago_accounts`, `payments`, `financial_ledger`, `payment_webhook_events`, `payment_event_queue`. Testes mock **não substituem** schema real, RLS nem triggers.

## Pacote H2 proposto, em ordem (não aplicado)

**B1 — Fundamentos:** extrair das migrations originais a criação efetiva de `restaurants`, `orders`, contas/relacionamentos, enums/checks, sequence `order_number`, helpers de RBAC/autorização e respectivas alterações subsequentes exigidas pelas RPCs; excluir **DML histórico e seeds** da versão específica de homologação, com diff revisado.

**B2 — Preço/pedido:** `order_pricing_snapshot`, `order_payment`, `checkout_order_idempotency`, trigger de sincronismo e RPC `create_order_with_snapshot_payment`, com RLS/grants e testes de dois preços da DEC-015.

**B3 — Pagamentos/ledger:** `payments`, `mercado_pago_accounts`, `financial_ledger`, eventos/fila, constraints/índices idempotentes e policies estritas. Não criar/ativar cron.

**B4 — Snapshot e receptor:** RPC `get_restaurant_financial_snapshot`; deploy controlado das Edge Functions `mp-webhook` e `mp-webhook-retry` **sem segredos externos e sem execução do worker**, apenas depois de B1–B3 + testes de RLS/contrato.

**B5 — E2E TEST:** após configuração de credenciais exclusivamente MP TEST, endpoint público assinado, seller teste e corte anti-replay, executar dados sintéticos e conciliação. Aprovação da fórmula DEC-021 é independente.

## Limites de execução
- **NÃO** executar as 206 migrations em lote, `supabase db push`, `supabase db reset` nem copiar dump ou dados de Production/Staging. O pacote reduzido só poderá ser executado quando a cadeia dependente tiver sido extraída e validada, sem inventar colunas, triggers, RLS ou ownership.
- O projeto de homologação está isolado em conta diferente, mas isso não dispensa isolamento de saídas de rede, secrets, webhooks e scheduler.
- Uma tabela sintética simplificada com nome igual ao de produção **não é** homologação da aplicação.
- Este arquivo não é migration SQL. O preflight é read-only. `PR #100` segue Draft, não mergeado.

## Resultado
**H2 diagnóstico: PASS. H2 implantação: NÃO EXECUTADA (dependências B1–B4 ainda não montadas).** Não foi possível provar o E2E. Gate Financeiro NO-GO; não houve escrita em Supabase nem deploy.

**Próxima unidade executável:** inventariar e extrair **apenas** os DDL de base realmente referenciados em B1–B3, com proveniência (arquivo/versão), checks RLS, dependências transitivas e scripts de rollback; então aplicar primeiro num banco de homologação isolado, com validação imediata de schema. Não aprovar merge/produção com base neste relatório.
