# Gate 4 — Auditoria de funções privilegiadas e writers financeiros

**Data:** 12/11/2026  
**Escopo:** Staging `dnotmvbhuqujvqdtgzav`; branch `audit/gate4-issue90-regression-tests`.  
**Método:** leitura de definições SQL ativas, triggers e `src/lib/checkout/OrderService.ts`; sem DML, migration, merge ou produção.

## Achado F-01 — Divergência de base de cálculo em trigger de INSERT (prioridade alta)

`public.tg_orders_snapshot_platform_fees()` é `SECURITY DEFINER`, `search_path=public`, e é executada por `orders_snapshot_platform_fees BEFORE INSERT ON public.orders`. Calcula taxa usando `NEW.total <= 30`, lê `platform_settings`, define `NEW.platform_fee`, `NEW.fixed_fee` e `NEW.commission_rate=0`.

O `PricingEngine` utiliza `subtotal <= 30`. `OrderService.createCheckoutOrder` envia `_total=pricing.customerTotal` e `_snapshot_subtotal=pricing.subtotal` para a RPC `create_order_with_snapshot_payment`. Logo, para consumidor pagador com subtotal R$ 30,00 e taxa R$ 0,99, `orders.total=R$ 30,99` e o trigger de BEFORE INSERT pode escolher R$ 1,49, enquanto o snapshot enviado usa R$ 0,99. O trigger `trg_sync_order_platform_fee_from_snapshot AFTER INSERT` corrige `orders.platform_fee` e `fixed_fee` após inserir snapshot. **Não foi possível provar que nenhum outro trigger, função ou efeito intermediário observa o valor transitório incorreto.**

**Recomendação, não autorização:** rastrear efeitos de triggers no INSERT e construir teste sintético isolado em staging antes de decidir correção mínima. Não mudar a fórmula de produção sem aprovação.

## Achado F-02 — Atualização legítima de snapshot por transição

`public.order_apply_transition` é `SECURITY DEFINER`, `EXECUTE` para `authenticated` e `service_role`, `search_path=public`. Possui matriz de transições, validações de `auth.uid()`, `has_role` para admin, owner do restaurante, cliente e courier, e bloqueio de `system/webhook` para usuário comum. Verifica pagamento aprovado em recuperação `falha_pagamento -> pago` e impede cancelamento de certos pagamentos MP aprovados sem reembolso.

Após atualizar status, modifica `order_pricing_snapshot.realized_platform_revenue` para `platform_revenue` em `entregue/concluido`, ou zero em `reembolsado/chargeback`. Portanto, **o snapshot não é imutável em todos os campos por design**. Separar campos de pricing congelados de estado de receita realizada antes de propor trigger de bloqueio. A presença de validações não substitui teste com JWTs distintos nem prova autorização de cada caminho.

## Achado F-03 — Escrita privilegiada via RPC e backend

`create_order_with_snapshot_payment` é `SECURITY INVOKER`, com `EXECUTE` limitado a `service_role` e `postgres`; insere `orders`, `order_pricing_snapshot`, `order_payment` e registro de idempotência em uma transação, usando advisory lock e hash de payload.

`OrderService.createCheckoutOrder` é server-side e usa `supabaseAdmin` para ler catálogo, calcular pricing e chamar a RPC com snapshot; input validado e restaurante ativo/aberto verificados. Isso cria uma superfície privilegiada **intencional**: a segurança depende de validação autoritativa dos inputs, isolamento por restaurante, integridade de hash e proteção da credencial. Não foi realizado inventário exaustivo de todos os writers `supabaseAdmin` em outras rotas e Edge Functions.

## Achado F-04 — Função de remuneração do entregador

`enforce_driver_earning_from_order_snapshot` é `SECURITY DEFINER`, `search_path=public`, acionada em `delivery_assignments BEFORE INSERT OR UPDATE` de campos selecionados. Lê `order_pricing_snapshot.delivery_fee` e define remuneração; na ausência de snapshot, marca revisão. Não altera diretamente o snapshot. Testes de integridade de vínculo assignment/order e RLS do writer continuam pendentes.

## Riscos adicionais

- `search_path=public` nas funções privilegiadas merece revisão de hardening conforme objetos efetivamente qualificados e grants de CREATE no schema.
- `order_apply_transition` confia em `auth.role()='service_role'` para bypass interno; avaliar exclusivamente com credenciais e contexto controlados.
- Não inferir que `EXECUTE` de trigger function para `PUBLIC` permite chamada direta por API.
- Não se conclui vulnerabilidade explorada, fraude ou perda financeira real.

## Próxima homologação proposta

1. Inspecionar dependências e efeitos de todos os triggers ativos de `orders` na inserção, especialmente os que usam `platform_fee`/`fixed_fee`.
2. Planejar testes read-only de discrepância `subtotal` vs `total` e teste transacional sintético com rollback, mediante autorização de execução controlada.
3. Auditar JWT/RLS multiempresa para `order_apply_transition` e `get_restaurant_financial_snapshot`.
4. Inventariar todos os writers privilegiados, incluindo Edge Functions e jobs.
5. Formalizar contrato dos campos congelados e mutáveis do snapshot.

**Gate Financeiro NO-GO.** Issue #90 aberta. DEC-021 aprovada somente no princípio contábil, sem autorização para implementação, merge, migration ou produção.
