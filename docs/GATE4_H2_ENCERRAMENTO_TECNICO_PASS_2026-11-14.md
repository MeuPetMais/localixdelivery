# Gate 4 — Encerramento técnico H2 no Supabase isolado (14/11/2026)

## Identificação e status

- **Ambiente alterado:** Supabase de homologação exclusiva `gvozcqyjhogmvebrwzap` (sa-east-1).
- **Referência consultada, apenas leitura:** Staging `dnotmvbhuqujvqdtgzav`.
- **Production:** não alterada. Sem deploy Vercel de produção, pagamentos reais, cron ou Edge Functions.
- **Branch:** `integration/gate4-financial-issue90`; PR #100 continua **Draft**, sem merge.
- **H2 estrutural:** **PASS TÉCNICO CONTROLADO — 54/54**.
- **Dependências H2 ampliadas:** **29/29 PASS**.
- **Gate Financeiro global / GO de produção:** **NO-GO** (requer homologação JWT/HTTP/MP TEST e contrato contábil DEC-021).

## Causa raiz encontrada e correções

1. Sandbox não continha o schema `private`, indispensável às funções originais de estoque e Customer 360.
2. Faltavam 17 tabelas auxiliares incluindo três FKs transitivas (`suppliers`, `menu_categories`, `inventory_locations`), 212 colunas, enum de movimento de estoque, 58 constraints, 28 índices e 12 funções originais.
3. Faltavam 14 triggers operacionais (incluindo sete em `orders` além dos já presentes). A reconstrução do grafo foi feita a partir dos catálogos reais de Staging, sem funções fictícias.
4. Teste transacional identificou **bug de configuração ausente**: `tg_rewards_enqueue_order_event` usa `IF NOT v_enabled THEN RETURN NEW`, mas `SELECT INTO` sem linha de `platform_settings` produz `NULL` e permite enfileiramento inesperado. Corrigido **no ambiente isolado** pela inicialização obrigatória da linha `platform_settings(id=true)` com `localix_rewards_enabled=false` e `localix_benefits_enabled=false`, conservando taxas de referência 0,99/1,49. Não alterei o código dessa função em Staging/Production.
5. Funções auxiliares `SECURITY DEFINER` tiveram execução direta revogada de PUBLIC, anon e authenticated; triggers seguem funcionais.
6. Após instalar o grafo, foi constatada ausência das políticas RLS dos objetos novos. Instalei as **30 policies de referência** com grants por papel e a dependência `restaurants.builders_enabled` / `private.is_builders_enabled`; schema `private` tem grant de USAGE controlado e funções financeiras/estoque permanecem indisponíveis para execução direta pelo usuário.

## Migrations aplicadas — somente homologação

- `20261114162229_gate4_h2_effective_schema_closure_isolated`
  - Arquivo: `supabase/homologation/gate4_h2_effective_schema_closure.sql`.
- `20261114162730_gate4_h2_rls_policy_parity_isolated`
  - Arquivo: `supabase/homologation/gate4_h2_rls_policy_parity.sql`.

A migration anterior `20261114160326_gate4_h2_columns_compatibility` preservou quatro colunas de compatibilidade.

## Evidências executadas após as migrations

| Ensaio | Resultado |
|---|---|
| Verificador oficial `gate4-h2-effective-contract-check.sql` | **33/33 PASS** |
| Verificador oficial `gate4-h2-transitive-dependency-check.sql` | **21/21 PASS** |
| `gate4-h2-deep-dependency-check.sql` | **29/29 PASS** |
| `gate4-b2-checkout-idempotency-rollback.sql` | 2 chamadas -> 1 pedido, 1 snapshot, 1 vínculo, 1 chave; **PASS** |
| Pedidos R$30,00 / R$30,01 sem snapshot | `orders.platform_fee` = R$0,99 / R$1,49; **PASS como caracterização do trigger**, **não prova PricingEngine** |
| Lifecycle `aguardando_pagamento -> pago -> aceito -> cancelado` | Perfil do cliente e 4 notificações, **PASS** |
| Rewards/fidelidade inativos | 0 eventos de rewards, 0 lançamentos de pontos; **PASS** |
| RLS proprietário A vs B (papel e claim simulados via SQL) | 1 registro próprio, 0 do outro estabelecimento; **PASS** |
| EXECUTE direto de `private.consume_order_stock` e `public.loyalty_apply` por authenticated | negado; **PASS** |
| Pós-testes `ROLLBACK` | 0 auth.users, pedidos, restaurantes, snapshots, ledger, webhooks, eventos de reward; linha singleton de settings preservada |
| Segurança | 29 tabelas public RLS; 48 policies (incluindo 30 novas); health advisor 0 findings |
| CI branch integrada | 5/5 PASS no SHA `28b68b3c` (Build, Tests, Typecheck, Lint, PostgreSQL concurrency) |

## Ressalvas de segurança e regras financeiras

- Advisor de segurança: três **INFO** de tabelas propositalmente restritas sem policies (`checkout_order_idempotency`, `mercado_pago_accounts`, `reward_order_event_queue`); não habilitar grants para silenciar alertas.
- Advisor **WARN** preexistente: `public.has_role(_user_id, app_role)` é `SECURITY DEFINER` executável por authenticated; requer revisão BOLA/enumeração e compatibilidade com políticas RBAC. Não revoguei indiscriminadamente.
- As tabelas e funções foram validadas em PostgreSQL real com claims sintéticos; **não houve teste com JWT emitido pelo Auth real/PostgREST, concorrência de duas sessões HTTP nem prova de paridade completa da aplicação**.
- A taxa DEC-015 foi caracterizada pela coluna `orders.total`, mas é necessário validar `PricingEngine`, `order_pricing_snapshot` e regra do pagador, porque pedidos podem conter a taxa de serviço no total. A taxa de teste é observação do trigger e não autorização de cobrança.
- Staging mantém configuração legada `platform_settings.commission_rate=0.05` no singleton; esse valor foi reproduzido como referência no sandbox, não aprovado como nova comissão. A cobrança autoritativa não pode depender dessa reprodução.
- Mercado Pago TEST, OAuth/split, webhook real, refund/chargeback/payout, reconciliação bancária, segregação contábil DEC-021, identidade econômica de lançamentos, limites de carga e GO financeiro **não foram comprovados**.
- O bloqueio fail-closed contra saldo ambíguo (diagnóstico de R$97,02) permanece obrigatório; nenhum ledger histórico foi reescrito.

## Parecer e critério de revisão

**Gate H2 de estrutura e integração SQL em homologação: ENCERRADO COM PASS TÉCNICO CONTROLADO.** A causa raiz identificada foi corrigida e os 54 contratos foram verificados no banco após aplicação, sem stubs. **Gate Financeiro global: NO-GO** até provas externas e aceite contábil. Não promover migrations de `supabase/homologation` para Staging/Production automaticamente.

**Esta decisão deve atualizar o Documento Mestre** após governança formal da arquitetura de homologação e aceite das regras financeiras; não foi realizada alteração do Documento Mestre neste commit.
