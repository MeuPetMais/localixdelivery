# Gate 4 — Rastreio de writers de pedidos e taxas (código e Edge Functions)

**Data:** 13/11/2026  
**Branch:** `audit/gate4-issue90-regression-tests`  
**Escopo:** leitura de arquivos selecionados do repositório; não é varredura exaustiva de todos os arquivos ou SQL dinâmico. Nenhum deploy, migration, merge ou escrita no banco.

## Resultados observados

### Checkout
`src/lib/checkout/OrderService.ts`: `createCheckoutOrder` usa `calculateAuthoritativeCheckoutPricing`, envia `pricing.customerTotal` como `_total` e `pricing.subtotal`, `pricing.platformFee`, `pricing.serviceFeePayer` ao snapshot na RPC `create_order_with_snapshot_payment`. A RPC do Staging insere pedido, snapshot, pagamento e idempotência sequencialmente.

### Acessos de aplicação selecionados
- `src/lib/orders/orders.functions.ts`: leituras de `orders` e chamadas `order_apply_transition`; nenhuma inserção direta em `orders` identificada nesse arquivo.
- `src/lib/public-orders.functions.ts`: leituras de `orders`/snapshot e atualização de status para cancelamento, sem escrita identificada em `platform_fee`.
- `src/lib/admin-orders.functions.ts`: consultas de `orders` e `order_pricing_snapshot`; o trecho inspecionado usa `snapshot.platform_fee` na projeção administrativa.
- `src/lib/payments/orderPayment.server.ts`: insere em `order_payment`, não em `orders`.

### Edge Functions selecionadas
- `supabase/functions/mp-payment-intent/index.ts`: lê `orders` e `order_pricing_snapshot`; caminho de cartão exige snapshot e falha com 409 se ausente. Inspeção de ocorrências não encontrou escrita direta de `platform_fee` em `orders`.
- `supabase/functions/mp-webhook/index.ts`: lê pedido, `order_payment` e snapshot, verifica associação do pagamento; nenhuma escrita direta de taxa em `orders` identificada na busca por padrões.
- `supabase/functions/stripe-webhook/index.ts`: contém lançamentos em ledger e split, merece revisão própria.
- **`supabase/functions/stripe-checkout/index.ts`: risco adicional de fórmula duplicada.** Consulta `orders.total` como `amountBRL` e, quando Stripe Connect split é elegível, chama `computePlatformFee(sb, amountBRL)`. A função chama o parâmetro `subtotal`, mas recebe **o total do pedido**. Ela consulta `platform_settings` e calcula faixa TIERED por `<=30`. Isso pode divergir da faixa do subtotal autoritativo. O código usa `STRIPE_SECRET_KEY_TEST`, mas **não foi possível provar** se a função está implantada, habilitada, invocável ou usada em produção; não declarar cobrança indevida.

## Evidências sobre banco Staging (investigação anterior)

`orders_snapshot_platform_fees` usa `NEW.total`, enquanto `PricingEngine` usa subtotal. `orders` não tem coluna subtotal. `trg_sync_order_platform_fee_from_snapshot` atualiza `orders.platform_fee` e `fixed_fee` após inserção de snapshot. Seis pares históricos divergentes em `platform_fee` ainda não têm writer causal identificado.

## Hipóteses pendentes

1. A divergência histórica 1,46 versus 0,99 pode ser legado ou writer posterior, mas **não foi possível provar** a causa.
2. Outros writers podem existir em componentes, migrações, RPCs com SQL não qualificado, scripts, cron ou integrações não revisadas.
3. O Stripe Checkout pode recalcular taxa com base incorreta; risco estático comprovado, impacto operacional não comprovado.

## Recomendação

- Não corrigir apenas o trigger antes de estabelecer o contrato completo de snapshot e identificar writers.
- Revisar a duplicação de taxa no Stripe Checkout separadamente, sem tocar gateway ativo nem produção.
- Continuar busca por writers de `orders.platform_fee` e `fixed_fee` e cronologia das seis divergências, com consultas somente leitura.
- Propor patches pequenos e separados, com regressões, CI, homologação PostgreSQL e rollback.

**Gate Financeiro: NO-GO. Issue #90 aberta.**
