# Gate Financeiro — execução integrada em Supabase isolado (2026-11-14)

## Destino e fronteiras
Supabase **somente homologação** `gvozcqyjhogmvebrwzap` (sa-east-1). Staging compartilhado `dnotmvbhuqujvqdtgzav` e Production `mvkfrwxgneqzvoabkaws` **não alterados** nesta execução. GitHub PR #100 Draft, sem merge.

## Migrations efetivamente aplicadas (sequência conferida no banco)
- `20261114145025_gate4_b1_foundation_homologation`
- `20261114145903_gate4_restrict_rls_event_trigger`
- `20261114150449_gate4_b2_b3_financial_storage`
- `20261114150702_gate4_b2_atomic_checkout`
- `20261114150919_gate4_b3_financial_snapshot`
- `20261114151245_gate4_restrict_order_number_trigger`

Cada SQL aplicada é versionada em `supabase/homologation`, separada da cadeia regular de 206 migrations; não deve ser executada em Production/Staging.

## Testes executados diretamente no PostgreSQL hospedado
1. B1: 3 tabelas base, 10 policies, 3/3 RLS e bloqueio de INSERT anônimo; dry-run anterior e validação pós-migration PASS.
2. B2/B3 storage: 7 tabelas financeiras, 7 policies, RLS habilitada e UPDATE/INSERT de usuário comum bloqueados pelos grants. DDL extraído de migrations originais de julho, somado às colunas/constraints finais relevantes.
3. Checkout idempotente: `scripts/gate4-b2-checkout-idempotency-rollback.sql`: 2 chamadas => **1** pedido, **1** vínculo de pagamento, **1** snapshot, **1** chave de idempotência; primeira `reused=false`, segunda `reused=true`, mesmo order_id, order_number 1001 e platform_fee 0.99 sincronizada.
4. Conflito de hash: `scripts/gate4-b2-checkout-hash-conflict-rollback.sql`: mesma chave e hash alterado é rejeitada por unique_violation, preservando **1** pedido e **1** vínculo; taxa do cenário sintético acima de R$30 persistida em 1.49. **Não prova PricingEngine**, pois a RPC recebe valores já calculados.
5. Ledger: `scripts/gate4-b3-db-idempotency-rollback.sql`: duplicata de `PAYMENT_APPROVED` bloqueada por índice, e duplicata de event_id de webhook bloqueada; **1** registro de cada após tentativa.
6. RLS por proprietário: `scripts/gate4-b3-financial-snapshot-rls-rollback.sql`: 1 lançamento próprio e 0 de outro restaurante.
7. RLS por admin: `scripts/gate4-b3-financial-admin-rls-rollback.sql`: administrador autenticado vê o lançamento autorizado do outro restaurante.
8. Todas as gravações dos cenários foram feitas dentro de `BEGIN/ROLLBACK`; verificação posterior revelou **0** usuários Auth, restaurantes, pedidos, vínculos, snapshots, Ledger, pagamentos, eventos, fila ou idempotency keys remanescentes.

## Segurança observada
- Acesso direto a `public.rls_auto_enable()` e `public.assign_order_number()` revogado de `anon`/`authenticated`, triggers preservados. Auditor Supabase não emitiu mais os avisos de EXECUTE público dessas funções.
- `has_role(uuid, app_role)` permanece `SECURITY DEFINER` executável por `authenticated` para suportar policies RLS. A superfície precisa de auditoria de BOLA/enumeração e eventual compatibilidade de RBAC antes de GO.
- `mercado_pago_accounts` e `checkout_order_idempotency` usam RLS sem policy pública de propósito (service_role-only); avisos de lint correspondentes não significam autorização aberta.
- Nenhuma Edge Function implantada. A revisão de código de `mp-webhook` detectou gravação preliminar de eventos antes de toda conciliação externa e fallback de assinatura para API MP; **não implantar publicamente antes de TEST secrets, rate limits, assinatura e testes de abuse**. `mp-webhook-retry` necessita `MP_WEBHOOK_RETRY_WORKER_SECRET`, `MP_WEBHOOK_REPLAY_SECRET`, SUPABASE key e cutover válido.

## Contratos estruturais comparados com Staging
- `scripts/gate4-h2-effective-contract-check.sql`: **24/33** no Supabase novo (33/33 em Staging).
- `scripts/gate4-h2-transitive-dependency-check.sql`: **13/21** no Supabase novo (21/21 em Staging).
- Total **37/54** controles presentes. Os 17 faltantes são `orders`/`restaurants` (triggers), `coupons`, e as funções transitivas: estoque, fidelidade, notificações, clientes, rewards, platform_settings. Essas funções não devem ser simuladas nem criadas sem suas tabelas, checks, idempotência e dependências originais.
- O trigger `tg_orders_snapshot_platform_fees` de Staging calcula com `NEW.total`, enquanto a DEC-015 requer verificar a base da faixa da taxa; antes de incluí-lo, confrontar a base econômica com PricingEngine/snapshot e testar o limite R$30,00.

## Bloqueios para GO financeiro (não superados)
1. Instalar e provar fielmente os 17 contratos estruturais transitivos restantes, mantendo integrações sem side effects externos.
2. Preparar credenciais **Mercado Pago TEST** (app e vendedor teste) e segredos em Supabase de homologação; não há evidência aqui de credenciais seguras configuradas. Não compartilhar segredos no chat.
3. Conectar checkout ao novo Supabase, implantar `mp-webhook`/retry com autenticação e cutover, e homologar PIX/cartão, OAuth, split, status, timeout, chargeback, refund, duplicatas e conciliação com API TEST.
4. DEC-021: somente o princípio contábil foi aprovado; fórmula/saldo final NÃO aprovados. Sem esta decisão não emitir GO de balanço/recebível.
5. Testes finais por persona com sessão JWT real (owner, gerente, cliente, admin, anon), monitoramento, rollback e autorização explícita de GO; CI pass isolado não substitui esses critérios.

**Resultado:** B1 + fundação B2/B3 e testes de banco = PASS com escopo limitado. **Gate Financeiro global = NO-GO**; não foi possível provar homologação E2E Mercado Pago. Nenhum merge, deploy público, cron, worker ou pagamento real executado.

**Esta decisão deve atualizar o Documento Mestre** caso o novo Supabase seja adotado formalmente como ambiente de homologação permanente.
