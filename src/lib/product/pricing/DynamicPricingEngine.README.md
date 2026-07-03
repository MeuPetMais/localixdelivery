# Dynamic Pricing & Promotion Engine

Motor de precificação dinâmica e promoções do **Product Domain**.

## Regras de ouro

- **NUNCA** substitui `PricingEngine` (`src/lib/payments/PricingEngine.ts`).
  Este motor só calcula **descontos**; totais finais de pedido continuam
  responsabilidade do `PricingEngine`.
- **NUNCA** calcula preços diretamente no frontend — sempre passa por
  `DynamicPricingService.apply(...)`.
- Integra com `BusinessRulesEngine` (validação), `CostEngine`/`MarginEngine`
  (alerta de margem negativa via `PriceSimulation`) e `NotificationCenter`
  (eventos via `PromotionEventBus`).

## Arquitetura

```
Product Domain
   ↓
DynamicPricingService  ← escolhe estratégia (BEST_FOR_CUSTOMER | PRIORITY | STACKABLE)
   ↓
PromotionRuleEngine    ← elegibilidade (horário, canal, cupom, cliente, min qty…)
DiscountCalculator     ← FIXED_AMOUNT | PERCENTAGE | FIXED_PRICE | BUY_X_GET_Y | FREE_ITEM | FREE_DELIVERY
   ↓
PricingEngine (Checkout) → totais finais + taxas
```

## Tabelas

- `promotions` — status/priority/dates/discount_type/discount_value/stackable/code/channel/config
- `promotion_rules` — regras condicionais (rule_type + operator + value JSONB)
- `promotion_targets` — alvo (product/category/all)
- `promotion_usage` — auditoria de uso por pedido/cliente

RLS: owner do restaurante gerencia; público (anon) lê apenas promoções `ACTIVE`.

## Suporte

- **Happy Hour** — `rule_type: time_window` + `weekday`
- **Cupons** — `code` na promoção + `coupon_code` no contexto
- **Combos** — `BUY_X_GET_Y` com `config: { buy_x, get_y }`
- **Preço por canal** — coluna `channel` na promoção
- **Preço por cliente** — `rule_type: customer | first_purchase`
- **Preço por horário/dia** — `time_window` + `weekday`
- **Preço por região** — arquitetura pronta (adicionar `rule_type: region`)

## Simulação

`PriceSimulation.run(promotions, ctx, costs)` retorna original,
desconto, final, custo total, margem % e alerta `negative_margin` via
`MarginEngine`.

## Eventos

`PromotionEventBus`: `PromotionCreated`, `PromotionActivated`,
`PromotionPaused`, `PromotionExpired`, `PromotionArchived`, `CouponUsed`,
`PriceChanged`, `PromotionMarginAlert`.

## Testes

`bunx vitest run src/lib/product/pricing/DynamicPricingEngine.test.ts`
(15 casos: percentage, fixed, buy_x_get_y, free_delivery, cupom, canal,
regras, estratégias, simulação de margem).
