# Gate 4 — Auditoria de permissões do snapshot financeiro

**Data:** 12/11/2026  
**Ambiente:** Supabase Staging `dnotmvbhuqujvqdtgzav`  
**Método:** SQL de catálogo PostgreSQL somente leitura e revisão dos arquivos já identificados no PR #96.  
**Status:** PASS parcial para grants/RLS; RISCOS e BLOCK para imutabilidade forte e testes JWT.

## 1. RLS e privilégios efetivos

- `order_pricing_snapshot`: `relrowsecurity=true`, `relforcerowsecurity=false`.
- Policy identificada: `Owners view their restaurant snapshots`, apenas `SELECT TO authenticated`; predicate relaciona `order_pricing_snapshot.order_id` a `orders.restaurant_id`, `restaurants.owner_id=auth.uid()`.
- Grants na tabela: `authenticated` tem somente `SELECT`; `anon` não apresentou grant; `service_role` tem `SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER`.
- Não foram encontradas policies de `INSERT`, `UPDATE` ou `DELETE` para `authenticated`. Assim, escrita direta por usuário comum não é autorizada pela combinação de grants e policies observada.
- A ausência de `FORCE ROW LEVEL SECURITY` e o uso de `service_role` exigem cuidado com caminhos privilegiados; não são por si só vulnerabilidade comprovada.

## 2. RPCs e funções

- `create_order_with_snapshot_payment`: `SECURITY INVOKER` (`prosecdef=false`); `EXECUTE` apenas `postgres` e `service_role`; recebe explicitamente valores do snapshot. Revisar autenticação/autorização no `OrderService` e validação de inputs.
- `get_restaurant_financial_snapshot`: `SECURITY INVOKER`; `EXECUTE` para `authenticated` e `service_role`; leitura deve ser testada com JWTs reais de tenants diferentes.
- `sync_order_platform_fee_from_snapshot`: função de trigger `SECURITY INVOKER` com `EXECUTE` para `PUBLIC`, `anon`, `authenticated` e `service_role`; exposição de ACL deve ser revisada. Não se conclui invocação SQL direta explorável de função trigger apenas por EXECUTE.
- `enforce_driver_earning_from_order_snapshot` e `tg_orders_snapshot_platform_fees`: `SECURITY DEFINER`, `EXECUTE` limitado a `postgres` e `service_role`. O uso privilegiado merece revisão de corpo, search_path e dependências.
- `order_apply_transition`: `SECURITY DEFINER`, `EXECUTE` inclui `authenticated`. A função contém referência a `order_pricing_snapshot`; exige auditoria específica de autorização e transições, sem concluir exploração.

## 3. Imutabilidade e superfície privilegiada

- Trigger encontrado em `order_pricing_snapshot`: `trg_sync_order_platform_fee_from_snapshot` `AFTER INSERT`; não foi encontrado trigger específico para proibir `UPDATE/DELETE`.
- `service_role` possui permissão de `UPDATE/DELETE`, logo a imutabilidade dos campos originais não é garantida apenas pela ACL. É necessário inventariar todos os writers privilegiados, inclusive Edge Functions, RPCs e jobs.
- `realized_platform_revenue` pode exigir atualização legítima posterior; antes de propor bloqueio, definir campos imutáveis versus fatos realizados e considerar lançamentos append-only.

## 4. Classificação e pendências

| Item | Estado | Limite |
|---|---|---|
| RLS habilitada e SELECT do dono vinculado a restaurante | PASS de configuração | Não substitui teste com JWTs reais |
| Escrita direta por `authenticated` ou `anon` | Sem grants observados | Não prova segurança de toda rota privilegiada |
| RPC de criação com EXECUTE restrito | PASS de ACL | Autorização do chamador server-side não testada |
| RPC de leitura com EXECUTE authenticated | REVISÃO | Exige isolamento multiempresa E2E |
| Funções SECURITY DEFINER relacionadas | REVISÃO PRIORITÁRIA | Examinar corpos, search_path e grants |
| Snapshot imutável após criação | NÃO PROVADO | service_role pode atualizar/excluir |
| Prova de exploit ou acesso cross-tenant | NÃO PROVADO | Sem execução com JWTs distintos |

## 5. Próximos passos sem mutações

1. Auditar corpo de `order_apply_transition` e `tg_orders_snapshot_platform_fees`, incluindo validação de tenant, status e search_path.
2. Inventariar chamadas privilegiadas `supabaseAdmin` e writes sobre `order_pricing_snapshot` em aplicação, Edge Functions e jobs.
3. Planejar teste JWT owner A / owner B / anon para SELECT e negação de UPDATE/DELETE.
4. Definir contrato de imutabilidade dos campos de pricing e ciclo de vida de `realized_platform_revenue`; propor alteração somente após autorização separada.

**Não foi possível provar** imutabilidade forte, isolamento E2E por JWT ou inexistência de writers privilegiados não inventariados.

**Nenhuma implementação, merge, migration, deploy ou alteração em produção foi autorizada ou realizada.** Gate Financeiro NO-GO; Issue #90 aberta.
