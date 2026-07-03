# Product Intelligence Engine

Motor de **inteligência baseada em dados** para o Product Domain — sem IA
generativa, preparado para futura integração com AI Engine.

## Regras de ouro

- **Não substitui** `CostEngine`, `PricingEngine`, `MarginEngine`, `Inventory`, `Recipe`, `Dynamic Pricing`, `Analytics`.
- Consome **estatísticas agregadas já calculadas** por outros domínios (o caller entrega `ProductSalesStat[]` + `OrderLineSample[]` + `availability`), evitando duplicar queries.
- Usa `MarginEngine.compute(...)` para performance/health.
- Publica eventos via `IntelligenceEventBus`.

## Arquitetura

```
Product Domain
   ↓
ProductIntelligenceService
   ├─ SalesRankingService
   ├─ ProductPerformanceService  → MarginEngine
   ├─ ProductHealthScoreEngine
   ├─ CrossSellService
   ├─ UpsellService
   └─ RecommendationEngine
   ↓
product_insights / product_recommendations   (RLS por owner)
   ↓
Restaurant Dashboard · NotificationCenter · Dynamic Pricing (sugere promo)
```

## Tabelas

- `product_insights` — product_id, insight_type (enum), severity, title, description, metadata
- `product_recommendations` — recommendation_type, product_id, related_product_id, score, status

Ambas com RLS por `restaurants.owner_id`.

## Tipos de insight

`BEST_SELLER | LOW_SELLER | HIGH_MARGIN | LOW_MARGIN | OUT_OF_STOCK | PRICE_REVIEW | PROMOTION | CROSS_SELL | UPSELL`

## Tipos de recomendação

`FEATURED | HIDE | PRICE_REVIEW | RECIPE_REVIEW | MARGIN_REVIEW | CROSS_SELL | UPSELL`

## Health Score

`0-100`, ponderado: **40% vendas + 30% margem + 20% disponibilidade + 10% reviews**.

## Server functions

- `listProductInsights({ restaurant_id, limit })`
- `listProductRecommendations({ restaurant_id, type?, limit })`
- `persistIntelligenceSnapshot({ restaurant_id, insights, recommendations, replace? })`

## Eventos

`InsightGenerated · RecommendationCreated · ProductHealthUpdated · CrossSellSuggested · UpsellSuggested`.

## Testes

`bunx vitest run src/lib/product/intelligence/` — 11 casos (rankings, performance, health, cross-sell, upsell, low/high margin, out-of-stock, best-seller, service orquestrador).
