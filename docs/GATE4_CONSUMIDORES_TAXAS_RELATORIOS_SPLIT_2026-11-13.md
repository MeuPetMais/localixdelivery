# Gate 4 — Auditoria de leitores de taxa, relatórios e split

**Data:** 13/11/2026  
**Branch:** `audit/gate4-issue90-regression-tests`  
**Escopo:** inspeção estática de componentes financeiros selecionados, sem execução de operações financeiras. **Stripe fora do escopo operacional**, por confirmação do responsável.

## Fatos comprovados no código

1. **Split Mercado Pago — `src/lib/payments/split.functions.ts`, linhas 59–100:** `runOrderSplit` consulta `orders` somente para `id, restaurant_id`; consulta `order_pricing_snapshot` para `restaurant_net, platform_revenue, gateway_fee, currency`. Constrói `SplitSnapshot` com esses campos. Nas linhas 143–147, plano PROCESSING é persistido para consumo por worker; a função **não comprova execução efetiva de transferência no gateway**.
2. **Admin financeiro — `src/lib/admin-finance-contract.ts`, linhas 167–179:** `sumSnapshots` agrega `snapshot.platform_fee`, `snapshot.platform_revenue`, `snapshot.realized_platform_revenue`, `snapshot.gateway_fee` e demais valores. Não lê `orders.platform_fee` nessa função.
3. **Detalhe administrativo — `src/lib/admin-orders.functions.ts`, linhas 525–546 e 633–649:** busca pedido e snapshot separadamente; `financial.platform_fee` é derivado de `snapshot.platform_fee`.
4. **Dashboard — `src/lib/finance/FinancialDashboardService.ts`, linhas 95–134:** lê ledger e chama `assertSingleRevenuePostingBasis(rows)` antes de agregar; taxas são somadas de lançamentos `PLATFORM_FEE`/`GATEWAY_FEE` aprovados, não do campo legado `orders.platform_fee` nesse caminho.
5. **Relatórios — `src/lib/finance/reports/FinancialReportService.ts` e `reports.functions.ts`:** a busca textual dirigida não encontrou referência literal a `orders.platform_fee`; isso não comprova ausência em SQL/RPC subjacente.

## Implicação para os seis pedidos históricos

Os seis pedidos PIX de 12/08/2026 apresentam `orders.platform_fee=1.46` e `snapshot.platform_fee=0.99`. Os leitores inspecionados de split/admin **não utilizam o valor divergente de `orders.platform_fee`**. A conciliação anterior encontrou apenas dois pagamentos pendentes e um ledger `PAYMENT_PENDING`; nenhuma aprovação nesse recorte.

**Não foi possível provar** ausência de consumo do campo legado em todos os relatórios, views, RPCs, triggers, jobs, exports, integrações e versões de código implantadas. Também não foi possível provar que as seis divergências não impactaram relatórios históricos, nem sua causa.

## Recomendação e bloqueios

- Manter snapshot como fonte para taxa de serviço e split; ledger para reconhecimento contábil conforme contrato DEC-021, sem somar bases incompatíveis.
- Próxima auditoria: examinar views e funções SQL ativas com referências a `orders.platform_fee` e `fixed_fee`; inventariar scripts e migrations que alteram esses campos.
- Não reescrever os seis registros históricos nem remover o trigger BEFORE INSERT até concluir inventário, testes PostgreSQL isolados e plano de rollback.
- Conferir webhook, conciliação e idempotência Mercado Pago antes do Gate GO.

**Gate Financeiro NO-GO. Nenhuma alteração em Staging ou Production; sem merge/deploy.**
