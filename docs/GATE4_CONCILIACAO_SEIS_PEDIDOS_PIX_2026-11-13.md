# Gate 4 — Conciliação histórica dos seis pedidos PIX divergentes

**Data:** 13/11/2026. **Ambiente:** Supabase Staging `dnotmvbhuqujvqdtgzav`. **Acesso:** somente leitura. **Gateway operacional:** Mercado Pago (Stripe excluído do escopo por confirmação do responsável).

## Universo e contagens

Filtro: `orders.platform_fee IS DISTINCT FROM order_pricing_snapshot.platform_fee`; seis pedidos criados em 12/08/2026, todos PIX Mercado Pago, `orders.platform_fee=1.46`, `snapshot.platform_fee=0.99`, `orders.fixed_fee=0.99`.

- `order_payment`: 6 linhas; cinco `PENDING`, uma `CANCELLED`.
- `payments`: 2 linhas vinculadas, ambas `pending`, `amount=9.49`, `platform_fee=0.00`. Pedidos prefixos `e7c4f088` e `a0814bf3`.
- `financial_ledger`: 1 linha vinculada, pedido `e7c4f088`, `transaction_type=PAYMENT_PENDING`, `status=PENDING`, `amount=9.49`.
- `order_status_history`: 6 transições, uma por pedido: cinco `aguardando_pagamento -> falha_pagamento` por `auto_expire:15min` (system), uma `aguardando_pagamento -> cancelado` por `customer_cancelled_before_payment` (customer).

## Conclusões

**Fato:** nenhum pagamento com status aprovado foi encontrado nas linhas consultadas de `payments`, `order_payment` e `financial_ledger` associadas aos seis pedidos.

**Fato:** há divergência histórica no campo legado `orders.platform_fee`; não há evidência de lançamento financeiro aprovado relacionado a ela neste recorte.

**Não foi possível provar:** liquidação real no Mercado Pago, ausência de eventos de gateway sem associação ao pedido, ausência de impacto em relatórios, causa da escrita `1.46` ou consistência de todas as outras linhas.

## Próximo gate

1. Consultar registros de eventos/webhook associados aos identificadores externos sem disparar reprocessamento.
2. Revisar o uso de `orders.platform_fee` em relatórios, split e contabilidade, priorizando snapshot autoritativo.
3. Confirmar status de liquidação diretamente no Mercado Pago por mecanismo seguro de auditoria, se necessário e autorizado.
4. Não corrigir valores históricos nem o trigger até confirmar contrato, regressões e rollback.

**Gate Financeiro NO-GO; Issue #90 aberta. Nenhum dado alterado, migration, merge ou deploy.**
