# Gate 4 H2 — implantação parcial validada e bloqueio de fechamento (14/11/2026)

**Alvo único:** Supabase `gvozcqyjhogmvebrwzap` (Homologação Localix). Staging compartilhado e Production **não alterados**. PR #100 permanece Draft.

## Mudança persistente executada

Migration SQL versionada `supabase/homologation/gate4_h2_columns_compatibility.sql` (commit `30d639c3`) aplicada no destino via Supabase, registrada como **`20261114160326_gate4_h2_columns_compatibility`**.

Colunas compatíveis com Staging efetivo:
- `public.orders.commission_rate numeric`, sem default;
- `public.orders.loyalty_points_reserved integer DEFAULT 0`;
- `public.orders.loyalty_points_consumed integer DEFAULT 0`;
- `public.restaurants.loyalty_settings jsonb` com `active=false` por padrão e parâmetros compatíveis com a referência.

A migração **não** instala triggers, jobs, política de concessão de pontos, funções de cálculo de taxas ou mudanças em Ledger, PaymentService, PricingEngine e gateway. O campo adicional de comissão não define nenhuma comissão financeira.

## Verificação após aplicação

- Histórico de migrations: versão `20261114160326` presente.
- `information_schema.columns`: 4/4 colunas e defaults confirmados.
- `scripts/gate4-b2-checkout-idempotency-rollback.sql`: **PASS**, 2 chamadas, 1 pedido, 1 pagamento, 1 snapshot, 1 chave, mesmo order ID; segunda chamada `reused=true`; order_number `1001`, fee sintética persistida `0.99`.
- Após rollback: zero usuários, restaurantes, pedidos, snapshots, pagamentos, ledger, webhooks e chaves de idempotência no ambiente.
- Health advisor: 0 findings.
- Security advisor: dois avisos informativos de RLS sem policies (checkout idempotency e MP accounts, bloqueadas para acesso público) e um WARN pré-existente relativo a `has_role` SECURITY DEFINER executável por `authenticated`. Sem grants adicionais nesta migration.

## Verificadores oficiais, efetivamente reexecutados

- `scripts/gate4-h2-effective-contract-check.sql`: **25/33 PASS**; 8 pendentes = critério `table:orders` + 7 triggers em `orders`.
- `scripts/gate4-h2-transitive-dependency-check.sql`: **15/21 PASS**; 6 funções de triggers pendentes.
- **H2 = 40/54** (as quatro colunas não fazem parte desses 54 checks).
- `scripts/gate4-h2-deep-dependency-check.sql`: **4/29 PASS**, após implantação das 4 colunas. **25 dependências** ainda ausentes = 14 relações auxiliares e 11 funções, sem contar FK/índices/policies/triggers transitivos.

## Critério de interrupção

O pacote restante **não pode ser certificado** por simples instalação dos nomes de seis funções e sete triggers: funções originais acessam `ingredients`, `recipe_items`, builders, stock_movements, `customers`, `customer_loyalty`, transações, notificações e rewards. O trigger de taxa referencia `platform_settings` e usa `NEW.total`, cuja semântica deve ser confrontada com DEC-015, PricingEngine e autoritatividade financeira. Publicar estas dependências parcialmente pode quebrar pedidos ou cobrar taxas incorretas.

**Situação:** compatibilidade parcial aplicada e testada, mas **não foi possível provar** 54/54 nem homologação E2E. Gate Financeiro **NO-GO**. PR #100 Draft, sem merge ou deploy. DEC-021 continua aprovação apenas de princípio e contas segregadas conceituais, não de fórmula final.

**Próxima implantação controlada requerida:** extrair DDL/constraints/RLS e funções dependentes dos 14 objetos restantes com fechamento até ponto fixo; executar teste descartável completo de pedidos e status com estoque e fidelidade, sem job/notification/reward externo; somente então instalar permanentemente e exigir 54/54 + E2E MP TEST + validação contábil. Não simular stubs como equivalência.
