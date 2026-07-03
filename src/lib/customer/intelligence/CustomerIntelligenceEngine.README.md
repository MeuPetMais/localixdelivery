# Customer Intelligence & Analytics Engine

Snapshot: 2026-07-03 · Prompt 13.6.3.

## Objetivo
Motor de inteligência do Customer Domain. Sem IA — apenas regras determinísticas
sobre dados reais. Prepara integração futura com AI Engine consumindo os
snapshots persistidos.

## Camadas

```
CustomerIntelligenceService  (facade)
  ├── CustomerAnalyticsService     — puro, agrega orders
  ├── CustomerScoreService         — puro, RFM + loyalty + engagement (0..100)
  ├── CustomerSegmentationService  — puro, resolve segmento primário e tags
  ├── CustomerRecommendationService — puro, sugestões acionáveis
  └── IntelligenceEventBus         — in-process
```

## Tabelas
- `customer_segments` (novo) — snapshot atual por cliente × restaurante.
- `customer_insights` (novo) — insights gerados, com severity.

## Segmentos
`NEW · ACTIVE · LOYAL · VIP · AT_RISK · INACTIVE · HIGH_VALUE · LOW_VALUE`

## Insights
`NO_PURCHASE · VIP_INACTIVE · AT_RISK · TICKET_DROP · FREQUENCY_DROP ·
BEHAVIOR_CHANGE · FAVORITE_CATEGORY · NEAR_LEVEL_UP`

## Health Score (0..100)
Peso: Recency 30% · Frequency 25% · Monetary 25% · Loyalty 15% · Engagement 5%.

## Reuso
- `orders` — histórico de pedidos (Order Domain).
- `customer_loyalty` — saldo/nível (Loyalty Engine).
- `CustomerTimeline`, `CustomerEventBus` — fundação.

## Eventos
`CustomerSegmentUpdated · CustomerInsightGenerated · CustomerScoreUpdated · CustomerHealthChanged`

## Segurança
RLS por `restaurant.owner_id = auth.uid()` em ambas as tabelas.

## Não implementa
- IA, modelos ML, LLM.
- Alteração de Order/Loyalty/Product/Finance/Notification.
- Cron/schedulers (podem ser plugados depois via `pg_cron` chamando o service).

## Pendências para 13.6.4
- Widgets no Restaurant Dashboard consumindo `restaurantOverview`.
- Wiring `NotificationCenter` como subscriber de `CustomerInsightGenerated`.
- Persistência automática de score/health delta.
