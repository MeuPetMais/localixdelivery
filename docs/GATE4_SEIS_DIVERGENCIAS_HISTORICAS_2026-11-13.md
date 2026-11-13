# Gate 4 — Investigação histórica das seis divergências de taxa (Staging)

**Data:** 13/11/2026  
**Ambiente:** Supabase Staging `dnotmvbhuqujvqdtgzav`  
**Modo:** SQL somente leitura. **Stripe excluído do escopo operacional**, conforme confirmação do responsável; gateway em foco: Mercado Pago.

## Resultado factual

Consulta de `orders` JOIN `order_pricing_snapshot` LEFT JOIN `order_payment`, filtrando `orders.platform_fee IS DISTINCT FROM snapshot.platform_fee`, retornou **seis pedidos**:

| ID (prefixo) | Criado em UTC (12/08/2026) | Status pedido | Status order_payment | orders.platform_fee | fixed_fee | snapshot.platform_fee |
|---|---|---|---|---:|---:|---:|
| f685367b | 15:05 | falha_pagamento | PENDING | 1,46 | 0,99 | 0,99 |
| 7ad9a7da | 15:27 | falha_pagamento | PENDING | 1,46 | 0,99 | 0,99 |
| ef41b56b | 15:54 | cancelado | CANCELLED | 1,46 | 0,99 | 0,99 |
| e7c4f088 | 15:55 | falha_pagamento | PENDING | 1,46 | 0,99 | 0,99 |
| 3c6a1c68 | 16:50 | falha_pagamento | PENDING | 1,46 | 0,99 | 0,99 |
| a0814bf3 | 18:21 | falha_pagamento | PENDING | 1,46 | 0,99 | 0,99 |

Todos: `payment_method=pix`, `order_payment.provider=mercado_pago`, `orders.total=9.49`, `snapshot.subtotal=3.50`, `snapshot.customer_total=9.49`. Snapshots foram criados segundos depois de cada pedido; `orders.updated_at` é posterior, mas não permite identificar o campo alterado.

## Análise

- **Fato:** os seis casos estão concentrados no mesmo dia, mesmo valor e mesmo método de pagamento; nenhum tem `order_payment.status=APPROVED` na consulta.
- **Fato:** trigger atual de snapshot `AFTER INSERT` sincroniza `platform_fee` e `fixed_fee` para `snapshot.platform_fee`. A existência de `fixed_fee=0.99` e `platform_fee=1.46` é compatível com escrita posterior, código histórico diferente ou alteração de dados anterior ao trigger atual.
- **Hipótese:** writer legado ou atualização posterior alterou somente `platform_fee`. **Não foi possível provar** a origem, a cronologia do campo nem se o trigger atual já estava implantado à época.
- **Não foi possível provar:** ausência de cobrança liquidada no gateway, de eventos históricos, de ledger ou de impacto em relatório, pois `order_payment.status` isoladamente não basta.

## Próximos testes seguros

1. Conferir migrations e commits históricos referentes a `platform_fee` e data de criação do trigger de sincronização.
2. Consultar somente leitura `payments`, `financial_ledger`, `payment_event_queue` e histórico de auditoria para os seis IDs, após inspecionar esquemas; não inferir valores de gateway.
3. Verificar funções e writers que atualizam `platform_fee` diretamente e potenciais divergências em outros pedidos sem snapshot.
4. Manter correção do trigger e qualquer saneamento de registros bloqueados até demonstrar causa e estratégia de rollback.

**Sem atualização de registros, migration, merge ou deploy. Gate Financeiro NO-GO; Issue #90 aberta.**
