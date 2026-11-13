# Gate 4 — Inventário de writers alternativos e proposta mínima de correção

**Data:** 13/11/2026. **Branch:** `audit/gate4-issue90-regression-tests`. **Escopo:** leitura de GitHub e catálogos PostgreSQL no Supabase Staging; sem writes. **Gateway operacional:** Mercado Pago, não Stripe.

## Evidências de código

- `src/lib/checkout/OrderService.ts`, linhas 240 e 414–415: `createCheckoutOrder` usa RPC `create_order_with_snapshot_payment`.
- `src/lib/orders/orders.functions.ts` e `src/lib/public-orders.functions.ts`: leituras de `orders` e transições por `order_apply_transition`; não se identificou INSERT direto nesses arquivos.
- `src/lib/orders/OrderOrchestrator.ts`: orquestra transição de status por dependências, sem inserção direta identificada.
- `src/lib/catalog/OrderingService.ts`: sem INSERT direto de `orders` identificado.

## Evidências de banco

Busca em `pg_proc.prosrc` nos schemas `public` e `private` por padrão de `INSERT INTO [public.]orders` encontrou duas funções:
1. `create_order_with_snapshot_payment`: writer principal, transacional, insere snapshot e payment.
2. **`reset_demo_environment`**: writer alternativo que insere pedidos demo diretamente em `public.orders`, incluindo `total`, `status` e itens; o trecho localizado não cria snapshot por meio da RPC.

A função `reset_demo_environment` é **SECURITY DEFINER**; privilégios EXECUTE efetivos observados: `anon=false`, `authenticated=false`, `service_role=true`. O acesso de serviço exige controle de credenciais; não comprova utilização real.

Privilégio INSERT em `public.orders` no inventário `information_schema.role_table_grants`: `postgres` e `service_role`; sem INSERT concedido a `anon` ou `authenticated` nessa consulta. Isso não impede writers de serviço, jobs ou código externo.

## Proposta de correção mínima — NÃO IMPLEMENTAR AINDA

**Opção A:** remover o cálculo BEFORE INSERT e exigir snapshot em todos os writers. Risco: `reset_demo_environment` e eventuais writers de serviço deixam `orders.platform_fee` sem valor esperado; exige inventário completo e adaptação.

**Opção B (preferência para estudo):** manter compatibilidade do trigger para inserções legadas, mas garantir que operações financeiras só consumam snapshot autoritativo, e tratar explicitamente caminhos sem snapshot. Não altera checkout, mas requer validar que qualquer operação de pagamento/split falhe fechada na ausência de snapshot; não corrige inconsistência transitória de `orders.platform_fee`.

**Opção C:** mover todas as inserções para RPC, incluindo demo. Mais coerente, porém amplia escopo e pode gerar efeitos colaterais.

**Recomendação provisória:** não modificar trigger até (i) revisar código completo de `reset_demo_environment`, seus consumidores e triggers associados, (ii) inventariar Edge Functions e demais writers `service_role`, (iii) estabelecer contrato explícito de pedidos sem snapshot, (iv) testar limites 29.99/30.00/30.01 com pagador cliente/restaurante em banco isolado, (v) validar rollback, idempotência, webhooks e split Mercado Pago.

**Não foi possível provar** inventário exaustivo de todos os caminhos, uso real da função demo ou causa das seis divergências de agosto. **Gate Financeiro NO-GO; Issue #90 aberta. Nenhum merge/deploy/migration.**
