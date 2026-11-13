# Gate 4 — Pedidos sem snapshot e contrato de bloqueio financeiro

**Data:** 13/11/2026. **Ambiente:** Supabase Staging `dnotmvbhuqujvqdtgzav`. **Acesso:** consultas somente leitura. **Gateway operacional:** Mercado Pago; Stripe não utilizado.

## Evidência observada

Consulta `orders LEFT JOIN order_pricing_snapshot` retornou **9 pedidos sem snapshot**:
- `demo`: 6 pedidos, datas históricas entre 03/08 e 11/08/2026, métodos PIX (4), cartão (1), dinheiro (1); status incluindo entregue, em_preparo, novo e saiu_para_entrega.
- `pizzaria-gula-staging`: 3 pedidos, 29/08/2026, todos `cash`; dois cancelados e um entregue.
- **0 linhas de `order_payment` associadas aos 9 pedidos**.

A função `public.reset_demo_environment()` tem corpo de 9.309 caracteres, `SECURITY DEFINER`, com `DELETE FROM public.orders` e `INSERT INTO public.orders`, mas **não contém referências textuais** a `order_pricing_snapshot`, `order_payment` ou `financial_ledger`. Privilégio EXECUTE: `anon=false`, `authenticated=false`, `service_role=true`. A origem exata dos três pedidos `pizzaria-gula-staging` não foi demonstrada.

## Implicações

**Fato:** a ausência de snapshot ocorre também fora do estabelecimento demo, em pedidos de dinheiro; não se deve pressupor que todo pedido histórico possui snapshot.

**Não foi possível provar:** se os pedidos de dinheiro são fluxos legados esperados ou defeito; se têm lançamentos em outras tabelas; se algum relatório contabiliza os pedidos sem snapshot; se algum worker cria snapshot depois.

## Contrato proposto (não implementado)

1. Operações de **cobrança online, split, reembolso e reconhecimento de receita de plataforma** exigem snapshot autoritativo validado, `order_payment` consistente e status reconciliado; ausência bloqueia operação e gera sinalização observável.
2. Pedidos de dinheiro/legados sem snapshot podem continuar **visíveis no operacional**, mas devem ser marcados como `financeiro_nao_conciliado` em projeções, sem imputar taxa automaticamente a partir de `orders.total`.
3. Não criar snapshots retroativos nem corrigir `orders.platform_fee` automaticamente: exige definição de contrato e auditoria de histórico.
4. Preservar o trigger de compatibilidade até inventário de todos os writers e teste isolado de migração/rollback.
5. Validar em PostgreSQL isolado os casos sem snapshot, com snapshot, limite R$30, pagador cliente/restaurante, idempotência, transições e webhook duplicado.

**Gate Financeiro NO-GO. Nenhum banco alterado, sem merge ou deploy.**
