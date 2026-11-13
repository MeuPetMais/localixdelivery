# Gate 4 — Testes controlados read-only de taxa e consistência de pedidos

**Data:** 12/11/2026  
**Ambiente:** Supabase Staging `dnotmvbhuqujvqdtgzav`  
**Autorização:** executar testes; **não** implementar, migrar, fazer merge ou alterar produção.  
**Execução efetiva:** SQL `SELECT` somente leitura, incluindo cenários sintéticos com `VALUES`; nenhuma inserção, atualização, exclusão, cobrança, webhook ou efeito externo.

## Teste T-01 — consistência de dados persistidos

Join `orders` + `order_pricing_snapshot`:
- 16 pares examinados;
- 6 divergências `orders.platform_fee` versus `snapshot.platform_fee`;
- todas as seis: `orders.platform_fee=1.46`, `snapshot.platform_fee=0.99`, `service_fee_payer=customer`;
- zero divergências `orders.fixed_fee` versus `snapshot.platform_fee`; os seis casos divergentes têm `fixed_fee` alinhado ao snapshot;
- 1 caso real em staging com pagador consumidor, `orders.total>30` e `snapshot.subtotal<=30`;
- intervalo de datas dos pedidos examinados: 12/08/2026 a 15/09/2026.

**Resultado:** FAIL de consistência do campo `orders.platform_fee` (6/16). Não se pode atribuir causa única nem efeito em cobrança/ledger sem rastrear versões e fluxos históricos. A existência do trigger AFTER INSERT não demonstra que todos os registros históricos tenham sido criados com ele, nem impede writes posteriores.

## Teste T-02 — simulação das duas bases de cálculo

Para cenário simplificado sem entrega/descontos/Benefits, a fórmula do PricingEngine é `subtotal <= 30`; a função `tg_orders_snapshot_platform_fees` usa `orders.total <= 30`. Consulta SQL com 6 linhas sintéticas:

| Subtotal | Pagador | Taxa do snapshot | Total pedido simplificado | Taxa BEFORE INSERT | Diverge? |
|---:|---|---:|---:|---:|---|
| 29,99 | customer | 0,99 | 30,98 | 1,49 | SIM |
| 30,00 | customer | 0,99 | 30,99 | 1,49 | SIM |
| 30,01 | customer | 1,49 | 31,50 | 1,49 | NÃO |
| 29,99 | restaurant | 0,99 | 29,99 | 0,99 | NÃO |
| 30,00 | restaurant | 0,99 | 30,00 | 0,99 | NÃO |
| 30,01 | restaurant | 1,49 | 30,01 | 1,49 | NÃO |

**Resultado:** FAIL de equivalência das fórmulas para 2/6 cenários sintéticos; a simulação não executa os triggers nem cria pedidos.

## Teste T-03 — efeitos intermediários e E2E

**BLOCK:** ainda não executado `INSERT` transacional com rollback, nem fluxo completo checkout → RPC → trigger → ledger → loyalty → Benefits → gateway. Sem prova de que a taxa transitória seja consumida por algum trigger subsequente ou de que haja cobrança indevida.

## Classificação de risco e recomendação

- **P1 para investigação:** divergência persistida em 6 pedidos de staging, sem inferir perda financeira.
- **P1 para teste dirigido:** base `NEW.total` no trigger versus subtotal autoritativo; investigar dependências `BEFORE/AFTER INSERT` e escritores de `orders.platform_fee`.
- **Não corrigir** dados históricos automaticamente; não alterar trigger, pricing, snapshots, gateway, Benefits ou produção.
- Próximo passo: traçar os writers e dependências e, com isolamento adequado, executar teste transacional com rollback que demonstre o estado real após RPC e triggers, além de verificar ausência de efeitos externos.

**Gate Financeiro NO-GO.** DEC-021 aprovada somente no princípio contábil; Issue #90 aberta.
