# Gate 4 H2 — execução segura do pacote de dependências (14/11/2026)

**Destino exclusivo:** Supabase `gvozcqyjhogmvebrwzap`. **Origem:** Staging `dnotmvbhuqujvqdtgzav`, somente leitura. **Produção não alterada**. Branch `integration/gate4-financial-issue90`, PR #100 Draft.

## O que foi efetivamente executado

1. Lidos diretamente no catálogo do Staging os corpos originais de cinco funções transitivas:
   - `private.consume_order_stock`: acessa `orders`, `stock_movements`, `recipe_items`, `ingredients`, `builder_option_ingredients`, `builder_options`, `builder_groups`, `builders`; pode alterar estoque e registrar movimentos.
   - `private.reverse_order_stock`: reverte movimentos e altera estoque.
   - `private.rebuild_customer_order_metrics`: atualiza `customers` a partir de pedidos entregues/concluídos.
   - `public.loyalty_apply`: escreve em `customer_loyalty` e `loyalty_transactions`, incluindo regra de idempotência.
   - `public.loyalty_rollback_reserve`: aplica ajuste de pontos e altera pedidos; depende de `loyalty_apply`.
2. Consultadas as colunas reais de tabelas transitivas e quatro campos adicionais de `orders`/`restaurants`.
3. Criado o teste SQL de somente leitura `scripts/gate4-h2-deep-dependency-check.sql`, que inspeciona relações, funções e colunas sem fazer DDL/DML.
4. Script executado no Staging e no sandbox. O primeiro ensaio apontou `order_items` inexistente **inclusive no Staging**; checklist corrigido para não inventar requisito.
5. No sandbox foi executado o DDL das quatro colunas em transação explícita `BEGIN ... ROLLBACK`. **4/4 colunas visíveis durante o ensaio; 0/4 após rollback**. Nenhuma alteração persistida.
6. Não implantados trigger, worker, cron, webhook, funções financeiras, roles ou políticas adicionais.

## Resultado objetivo do verificador profundo

Após correção do falso positivo `order_items`:
- **14 relações auxiliares** faltam no sandbox: `customers`, `customer_notifications`, `loyalty_transactions`, `customer_loyalty`, `platform_settings`, `reward_order_event_queue`, `stock_movements`, `ingredients`, `recipe_items`, `builder_option_ingredients`, `builder_options`, `builder_groups`, `builders`, `menu_items`.
- **11 funções** faltam no sandbox: as 6 funções H2 e as 5 transitivas acima.
- **4 colunas** faltam no sandbox: `orders.commission_rate`, `orders.loyalty_points_reserved`, `orders.loyalty_points_consumed`, `restaurants.loyalty_settings`.
- **Total: 29 dependências ausentes** (sem contar seus próprios triggers, policies, FK, índices, enums e dependências transitivas adicionais).
- O verificador H2 anterior permanece **40/54**. O teste profundo é adicional, não altera o denominador do H2.

## Por que NÃO houve aplicação permanente

As funções originais executam DML em estoque, pontos, perfil do cliente e filas. Uma cópia sem fechar todo grafo falha em pedidos ou produz efeitos inconsistentes. Triggers e tabelas adicionais possuem constraints, policies, funções e enums dependentes que devem ser instalados com fidelidade. `tg_orders_snapshot_platform_fees` lê `platform_settings` e classifica a taxa pelo `NEW.total`; esta base deve ser conciliada com o PricingEngine e DEC-015 (limiar R$30) antes de permitir processamento de cobrança.

## Critério para desbloquear o pacote

Extrair schema **final** e dependências até ponto fixo de Staging para as 14 relações; comparar definições e hashes com migrations oficiais; validar grants/RLS, triggers, enums, índices únicos, cron e side-effects; montar migration isolada versionada somente para homologação; testar `BEGIN/ROLLBACK` com checkout, atualização de status e fidelidade/estoque sem integrações externas; executar os 54 checks e matriz financeira completa antes de aplicar permanentemente. Não criar stubs nem copiar produção de forma implícita. DEC-021 ainda não aprova fórmulas e liquidação.

**Parecer:** Auditoria aprofundada e dry-run de colunas PASS; implantação integral bloqueada por 29 dependências estruturais ainda sem pacote de equivalência. **Não foi possível provar 54/54**; Gate Financeiro NO-GO.