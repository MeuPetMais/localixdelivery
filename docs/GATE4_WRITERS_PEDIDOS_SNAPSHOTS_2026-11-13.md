# Gate 4 — Investigação dos writers de pedidos e snapshots (somente leitura)

**Data:** 13/11/2026  
**Branch:** `audit/gate4-issue90-regression-tests`  
**Supabase:** Staging `dnotmvbhuqujvqdtgzav`  
**Status:** evidência parcial, sem migração ou alteração de produção.

## Caminho principal confirmado

No `src/lib/checkout/OrderService.ts`, `createCheckoutOrder` resolve itens e descontos server-side, calcula pricing autoritativo, constrói hash do payload e chama a RPC `create_order_with_snapshot_payment`. Envia `_total=pricing.customerTotal`, `_snapshot_subtotal=pricing.subtotal`, `_snapshot_platform_fee=pricing.platformFee`, pagador e demais componentes do snapshot.

A função **real** inspecionada em Staging:
- verifica chave de idempotência e hash, usa `pg_advisory_xact_lock`, retorna pedido existente para replay com mesmo hash e rejeita conflito;
- insere em `public.orders` **sem preencher `platform_fee` nem `fixed_fee`**;
- insere em `public.order_pricing_snapshot` com taxa/subtotal fornecidos;
- insere em `public.order_payment` e em `checkout_order_idempotency`.
- `prosecdef=false`: RPC não é `SECURITY DEFINER`. A aplicação usa `supabaseAdmin`; revisar privilégios de execução e acesso separadamente.

A ordem é transacional no contexto da RPC. **Não foi possível provar** que todos os caminhos de pedido passam por ela, nem ausência de efeitos externos nos triggers.

## Triggers relevantes observados em Staging

- `orders_snapshot_platform_fees`: BEFORE INSERT; taxa por `NEW.total <= 30`, sobrescreve `platform_fee`, `fixed_fee` e `commission_rate=0`.
- `trg_sync_order_platform_fee_from_snapshot`: AFTER INSERT no snapshot; UPDATE de `orders.platform_fee` e `fixed_fee` para `NEW.platform_fee`.
- Outros triggers em `orders`: `orders_set_updated_at` BEFORE UPDATE; `trg_order_notify_customer_ins`, `trg_orders_loyalty_status`, `trg_orders_upsert_customer`, `trg_rewards_enqueue_order_event` AFTER INSERT; triggers de UPDATE OF status para estoque/notificações/loyalty/CRM/Rewards.

A atualização feita pelo sync do snapshot pode acionar `orders_set_updated_at`; não aciona automaticamente triggers definidos somente como UPDATE OF status se status não for incluído no SET. **Não foi possível provar** efeitos indiretos de outros objetos ou consumidores assíncronos.

## Busca preliminar em funções do banco

Consulta de `pg_proc.prosrc` para texto `INSERT INTO public.orders`, `UPDATE public.orders` ou `platform_fee` encontrou `create_order_with_snapshot_payment`, `sync_order_platform_fee_from_snapshot`, `tg_orders_snapshot_platform_fees` e funções de loyalty/transição/reset. **Não é inventário exaustivo**: SQL dinâmico, funções com nome não qualificado, Edge Functions e writes diretos da aplicação podem escapar.

## Risco central ainda não resolvido

A auditoria anterior de 16 pares em Staging mostrou 6 com `orders.platform_fee=1.46` e `snapshot.platform_fee=0.99`, embora `orders.fixed_fee=0.99` em todos. Portanto, a sincronização inicial do snapshot **não prova** ausência de sobrescritas posteriores ou dados legados.

## Próxima verificação necessária

1. Busca no repositório por `.from('orders').insert/update/upsert`, RPCs adicionais e Edge Functions que alteram `platform_fee`.
2. Auditar triggers e writers em tabelas correlatas e cronologia de migrações, com atenção à origem do valor 1,46.
3. Verificar privilégios da RPC e RLS, caminhos sem snapshot, order creation por cash/manual/admin, e contrato de `commission_rate`.
4. Só depois escolher entre remover o cálculo duplicado no BEFORE INSERT, adaptar a criação do pedido ou manter fallback explicitamente seguro.

**Sem correção aplicada. Gate Financeiro NO-GO; Issue #90 aberta.**
