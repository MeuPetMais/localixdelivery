# Analytics & Business Intelligence Platform

Single domain that consolidates KPIs, dashboards, insights and exports for
the entire Localix stack.

## Architecture

- `AnalyticsPlatform` — facade. Only entry point for consumers.
- `DashboardBuilders` — pure functions that map already-computed domain
  metrics into KPI sections. Never queries tables.
- `KpiCalculator` — trend/delta/percent math shared by every builder.
- `InsightsAggregator` — normalizes insights produced by
  Customer / Product / Finance / Delivery / Inventory domains.
- `AnalyticsExportService` — CSV / XLSX / PDF payload generation.
- `SnapshotStore` — in-memory cache (60s TTL) keyed by scope + tenant + range.
- `DateRangeService` — comparison presets (today/yesterday, WoW, MoM, YoY, custom).
- `AnalyticsPermissions` — role → scope matrix.
- `AnalyticsAudit` — append-only audit log for reads/exports.
- `AnalyticsEventBus` — `DashboardGenerated`, `SnapshotStored`,
  `InsightPublished`, `ExportGenerated`, `KpiComputed`.

## Rules

- Dashboards MUST consume domain Services (Customer, Product, Finance,
  Payment, Orders, Delivery, Inventory, Platform). This domain never reads
  raw tables.
- No calculation is duplicated: percentages, deltas and averages route
  through `KpiCalculator`.
- Snapshots are cacheable and invalidatable per scope × tenant.
- Exports reuse the same snapshot shape — no re-computation.

## Scopes

`platform` · `executive` · `restaurant` · `operations` · `financial` ·
`customer` · `product` · `delivery` · `inventory` · `marketing`.

## Consumers

Callers gather domain metrics (e.g. `FinancialDashboardService`,
`CustomerIntelligenceService`, `PlatformDashboardService`) and pass them to
`AnalyticsPlatform.generateDashboard({ scope, filter, sections, insights })`.
