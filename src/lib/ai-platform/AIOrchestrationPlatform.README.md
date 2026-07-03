# AI Orchestration Platform

Provider-agnostic scaffold. **Does not integrate any real model** — every call
runs through the deterministic `mock` provider until real providers are
registered via `AIProviderRegistry.register(...)` in Prompt 19+.

## Modules (`src/lib/ai-platform/`)

| File | Purpose |
| --- | --- |
| `AIOrchestrator` | Runs a skill: safety → context → prompt → provider → usage/audit/events |
| `AIProviderRegistry` | Pluggable providers (`openai`, `gemini`, `claude`, `mock`) behind one interface |
| `AISkillRegistry` | 7 skills (restaurant / financial / product / inventory / marketing / operational / admin) with domain + permission metadata |
| `PromptManager` | Versioned templates, active pointer, render with variables, immutable history |
| `ContextBuilder` | Pure snapshot builder with sanitization + sensitive-key redaction |
| `AISettingsService` | Per-tenant enable/skills/limits/language/default model+provider |
| `AISafetyLayer` | Access + permission + monthly request/token limit checks |
| `AIUsageService` | Metrics: requests, tokens, cost, latency, per-skill/provider summaries |
| `AIAuditService` | Immutable prompt/response hash audit, tenant-scoped |
| `AIEventBus` | `AISkillInvoked` / `Completed` / `Denied` / `AILimitExceeded` |
| `AIForecastService` | Pure linear-regression scaffold: sales/demand/inventory/financial |
| `AIRecommendationsService` | Aggregates recommendations from other domains — never invents rules |

## Non-duplication guarantees

- No business rules created here. Skills consume `domain_snapshot` supplied by
  callers, which comes from public Services of Customer, Product, Finance,
  Inventory, Delivery, Analytics, Marketing.
- Forecast is a purely statistical scaffold; domain-specific projections stay
  inside their own domains.
- Segments / campaigns / metrics are never recomputed — recommendations only
  re-rank items other domains already produced.

## Safety model

Every `AIOrchestrator.run` call passes through `AISafetyLayer`:
- tenant AI toggle
- skill enabled per tenant
- required permission for the skill
- monthly request + token limits (from `AIUsageService.monthlyCount`)

Failed checks emit `AISkillDenied` and, when limit-related, `AILimitExceeded`.

## Pending (Prompt 19)

- Real provider adapters (OpenAI / Gemini / Claude) via existing
  `connecting-to-ai-models-tanstack` gateway.
- Persistent Supabase tables for `ai_usage`, `ai_audit`, `ai_settings`,
  `ai_prompt_templates`.
- RLS policies + admin UI panels.
- Advanced forecast models per domain.
