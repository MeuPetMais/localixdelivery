# Gate 4 — B1 / Fundação em transação reversível (14/11/2026)

## Execução
- Projeto exclusivo de homologação: `gvozcqyjhogmvebrwzap` (conta `Homolocação localix`).
- Fonte versionada: `scripts/gate4-h2-b1-foundation-rollback.sql`, branch do PR #100.
- A transação `BEGIN ... ROLLBACK` foi **executada com sucesso** por `execute_sql`, sem chamar Mercado Pago, ativar cron, processar webhook ou importar dados reais.
- Antes do ROLLBACK, a consulta interna confirmou:
  - **3 tabelas-base** `user_roles`, `restaurants`, `orders`;
  - **10 policies RLS**;
  - **3 tabelas com RLS habilitada**;
  - `anon_has_role_execute = false`;
  - `anon_orders_insert = false`.
- Após o ROLLBACK, consulta SQL independente confirmou **0** tabelas B1, **0** policies B1 e `app_role` inexistente; `list_migrations` também retornou **0**.
- Production e Staging foram somente referência/read-only em passos anteriores.

## Escopo e limitações
O arquivo é deliberadamente **baseline parcial não aplicável como migration final**. Preserva as definições-base originais de restaurantes, papéis e pedidos e o padrão final de policies observado em Staging, mas ainda não contém todas as colunas, FKs, helpers e triggers finais da aplicação (estoque, fidelidade, notificações, número de pedido, snapshot, parceiros, histórico, cupons, pagamentos). Portanto, não satisfaz os 54 contratos do H2 e não pode suportar um checkout E2E representativo.

**Resultado:** B1 foundation **PASS no dry-run reversível**, **NÃO INSTALADA**. Gate Financeiro continua NO-GO. PR #100 Draft; nenhuma autorização de merge, deploy ou uso de credenciais MP reais.

## Próxima execução necessária
Transformar o baseline em instalação fiel, completando a cadeia de DDL e funções privilegiadas dependentes, com guards contra chamadas externas/agendamentos e dry-run repetível. Validar todos os 54 critérios estruturais e depois testes de RLS por persona em ambiente de homologação; somente então adicionar B2/B3 e configurar Mercado Pago TEST.
