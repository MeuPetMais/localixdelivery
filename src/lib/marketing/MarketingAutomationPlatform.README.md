# Marketing Automation Platform

Pure service facade over existing domains. No new DB tables. Consumes:

- **CustomerIntelligenceService** → audience candidates (segments, spend, orders)
- **CustomerCommunicationService** → channel consent + delivery history
- **LoyaltyService** → level/cashback triggers
- **AnalyticsPlatform** → aggregate KPI dashboards
- **NotificationCenter** → actual delivery (dispatching not duplicated here)

## Modules

| File | Purpose |
| --- | --- |
| `CampaignService` | Lifecycle (draft → scheduled → running → completed/cancelled) with audit + events |
| `AudienceBuilder` | Pure filter over candidates by segment, consent, channel, orders, spend |
| `AutomationEngine` | Trigger-based automations (welcome, post-purchase, birthday, ...) |
| `JourneyBuilder` | Multi-step journeys with validation |
| `ABTestingEngine` | Deterministic bucket-based variant assignment (reuses `platform-config/rollout`) |
| `CampaignSchedulerService` | Simple in-memory job queue with `due(at)` sweep |
| `CampaignTemplateService` | Builtin + custom templates per type/channel |
| `CampaignAnalyticsService` | Rate/ROI computation and aggregation |
| `MarketingAudit` | Immutable, tenant-scoped audit log |
| `MarketingEventBus` | Domain events for cross-domain reaction |

## Non-duplication guarantees

- Segments come from `CustomerSegmentationService`; never recomputed here.
- Channel dispatch remains inside `NotificationCenter`; this domain only decides *who* + *when* + *with which template*.
- Metrics use `CampaignAnalyticsService`; broader KPI dashboards go through `AnalyticsPlatform`.
- Consent is honored by refusing to include a candidate whose `marketing_consent === false`.

## Pending (Prompt 18)

- Persistent Supabase tables for campaigns, automations, journeys, metrics.
- Provider integrations for EMAIL/SMS/WhatsApp (currently structural).
- Cart-recovery event source hookup.
- Admin UI panels.
