# Gate 4 / H2 — Fechamento de dependências transitivas (2026-11-14)

## Verificações executadas

Execução SQL de somente leitura diretamente nos projetos:
- **Staging referência** `dnotmvbhuqujvqdtgzav`: `scripts/gate4-h2-effective-contract-check.sql` **33/33 PASS** e `scripts/gate4-h2-transitive-dependency-check.sql` **21/21 PASS**.
- **Homologação isolada** `gvozcqyjhogmvebrwzap`: **0/33 e 0/21**, pois o schema da aplicação ainda não foi instalado.
- Contratos totais: **54**. São verificações de existência/estrutura, não testes de comportamento financeiro ou prova E2E.

## Dependências comprovadas do Staging

Tipos `public.app_role` (12 valores), `public.ledger_status` (4 valores), `public.ledger_transaction_type` (11 valores).

Relações auxiliares `public.coupons` e `public.user_roles`, além de FKs obrigatórias:
`orders_coupon_id_fkey`, `orders_restaurant_id_fkey`, `orders_customer_id_fkey`,
`financial_ledger_order_id_fkey`, `financial_ledger_restaurant_id_fkey`,
`payment_event_queue_event_id_fkey`.

Funções que suportam triggers: `public.tg_set_updated_at`,
`public.sync_order_platform_fee_from_snapshot`,
`public.assign_order_number`, `public.enforce_partner_email_only`,
`public.tg_order_notify_customer`, `public.tg_orders_loyalty_status`,
`public.tg_orders_snapshot_platform_fees`,
`public.tg_rewards_enqueue_order_event`,
`private.apply_order_stock_status_transition` e
`private.upsert_customer_from_order`.

**8 das 10 funções** estão marcadas `SECURITY DEFINER`, incluindo duas em schema `private`. Essas funções e as funções chamadas por elas exigem inspeção de grants e isolamento de efeitos antes da instalação. A busca textual inicial de padrões de rede no corpo das 10 funções não encontrou URL/pg_net, mas **isso não prova ausência de chamadas externas transitivas**.

## Resultado e execução permitida
- A fonte das 10 tabelas originais está extraída por `scripts/gate4-h2-ddl-extract.ts` com hashes e provenance.
- Os verificadores de 33 + 21 contratos estão versionados no PR #100.
- **Não instalar CREATE TABLE isolado**, pois as FKs, helpers, funções privilegiadas e contratos de pedidos exigem o fechamento transitivo e testes de equivalência com os 54 critérios. Não copiar o histórico integral de 206 migrations sem sanitização de DML/cron/seed.
- **Próxima execução:** gerar a migration B1 executável somente com definições originais revisadas de `restaurants`, roles e `orders` e suas dependências fechadas, mantendo integridade RLS/RBAC; validar primeiro numa transação de teste descartável, com rollback e sem webhooks, antes de instalar no projeto isolado.
- O novo projeto continua sem alterações estruturais; não foi executada nenhuma migration. Produção e Staging não foram modificados. Gate financeiro **NO-GO**, PR #100 **Draft**. Não foi possível provar E2E.

