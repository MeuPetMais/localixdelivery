# PricingEngine — Documentação

Motor financeiro **central** da Localix. É o **único** local autorizado
a calcular subtotais, taxas, descontos, líquidos e receitas de pedido.

## Regra de ouro

Componentes React, Checkout, Carrinho, `PaymentService`, Providers e
Edge Functions **nunca** calculam valores financeiros diretamente —
sempre delegam para `PricingEngine.calculateOrderPricing()`.

## Fluxo de cálculo

1. `calculateOrderPricing(input)` carrega configuração de
   `platform_settings` (cache de 60s; fallback para defaults se a
   tabela estiver vazia).
2. Valida `subtotal >= minimum_order` (senão lança `PricingError`
   com code `ORDER_BELOW_MINIMUM`).
3. Escolhe `platformFee`:
   - `subtotal <= 30` → `platform_fee_until_30` (padrão R$ 0,99)
   - `subtotal > 30`  → `platform_fee_above_30` (padrão R$ 1,49)
4. Escolhe `GatewayFeeCalculator` pelo provider informado
   (fallback: `default_gateway`). No Prompt atual, todos retornam 0.
5. Monta `PricingResult`.

## Entradas — `PricingInput`

| Campo            | Tipo                            | Obrigatório | Descrição                            |
| ---------------- | ------------------------------- | ----------- | ------------------------------------ |
| `subtotal`       | number                          | sim         | Soma dos itens do pedido             |
| `deliveryFee`    | number                          | não         | Frete                                |
| `couponDiscount` | number                          | não         | Desconto de cupom                    |
| `cashback`       | number                          | não         | Cashback aplicado                    |
| `paymentMethod`  | pix/credit_card/debit_card/cash | não         | Método (usado por gateway calc)      |
| `provider`       | mercado_pago/pagarme/asaas/stripe | não       | Gateway alvo                         |
| `restaurantId`   | string                          | não         | Reservado para taxas por parceiro    |

## Saídas — `PricingResult`

`subtotal`, `deliveryFee`, `platformFee`, `gatewayFee`,
`couponDiscount`, `cashback`, `customerTotal`, `restaurantGross`,
`restaurantNet`, `platformRevenue`, `gatewayRevenue`,
`estimatedProfit`, `currency`.

## Configuração — tabela `platform_settings`

Colunas usadas pelo engine:

- `minimum_order` (default 20,00)
- `platform_fee_until_30` (default 0,99)
- `platform_fee_above_30` (default 1,49)
- `default_gateway` (default `mercado_pago`)
- `gateway_enabled` (JSONB, default `{"mercado_pago": true}`)
- `currency` (default `BRL`)

Alterar regras de negócio = `UPDATE public.platform_settings`. O engine
recarrega em até 60s (ou chame `PricingEngine.clearCache()`).

## Adicionar novo gateway

1. Registrar em `payment_providers` (`active=true`, flags de suporte).
2. Implementar `GatewayFeeCalculator` novo em `PricingEngine.ts`
   (ex.: `PagarmeCalculator`).
3. Registrar no mapa `gatewayCalculators`.
4. Atualizar `default_gateway`/`gateway_enabled` em `platform_settings`
   quando quiser habilitá-lo para o marketplace.

## Preparado para o futuro

Estrutura pensada para receber, sem quebrar API pública:
taxa percentual, taxa fixa, cupom, cashback, taxa dinâmica, promoções,
happy hour, frete grátis, fidelidade, taxa por cidade, por parceiro,
por categoria, por distância e por horário.

## Testes

`src/lib/payments/PricingEngine.test.ts` cobre pedidos de R$20, R$25,
R$30, R$31, R$50, pedido com cupom e pedido abaixo do mínimo.

Rodar: `bunx vitest run src/lib/payments/PricingEngine.test.ts`.
