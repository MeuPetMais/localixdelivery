# Gate 4 — Encerramento controlado da implantação B1 (2026-11-14)

## Implantação real comprovada

**Somente** no Supabase isolado `gvozcqyjhogmvebrwzap` (conexão Homolocação localix) foi aplicada, por `apply_migration`, a SQL original revisada como `supabase/homologation/gate4_b1_foundation.sql`, criada a partir do dry-run B1 previamente aprovado com ROLLBACK.

O conector retornou `success:true`. Inventário de migrations após implantação registrou:
- `20261114145025_gate4_b1_foundation_homologation`.

Verificação independente pós-migration:
- `base_tables=3`: `user_roles`, `restaurants`, `orders`.
- `base_policies=10`.
- `rls_enabled=3`.
- `anon_orders_insert=false`.
- `anon_role_execute=false`.
- `premature_financial_tables=0`: sem pagamentos, ledger, snapshots e filas.
- `list_edge_functions`: `[]`.

## Escopo fechado e limites de segurança

**B1 FUNDACIONAL = PASS INSTALADO**. A SQL no diretório `supabase/homologation` não deve ser incluída automaticamente em migrations de aplicativo ou executada em Production/Staging. O projeto de homologação permanece desconectado de qualquer frontend/MP; não configurar credenciais, links, webhooks ou workers antes de completar os blocos.

A B1 **não reproduz ainda o schema final de pedidos**: campos adicionais, FK de cupons, helpers, triggers de status, fidelidade/estoque/notificações/CRM, RBAC por persona completo, scripts de dados sintéticos. Ela mantém somente RLS e privilégios iniciais de fundação para fechar um bloco independente.

**Gate 4 financeiro global = NO-GO**. Para conclusão do Gate 4 falta B1 fechamento operacional integral; B2 preço e criação atômica de checkout; B3 pagamentos/ledger e idempotência; B4 webhooks e RLS; B5 testes Mercado Pago TEST + conciliação DEC-021. Não foi possível provar funcionamento E2E.

## Estado do PR
PR #100 permanece **Draft / sem merge**; Production e Staging não foram modificados. Nenhum deploy externo, pagamento, job, cron ou webhook ocorreu nesta execução.

**A execução do ambiente de homologação como projeto separado não muda as decisões de negócio; caso esse isolamento seja formalizado como arquitetura permanente, esta decisão deve atualizar o Documento Mestre.**
