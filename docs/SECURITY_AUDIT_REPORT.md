# Security Audit Report — Prompt 21 (Security Hardening)

Scope: authentication, authorization, RBAC, RLS, edge/server functions, APIs,
EventBus, workers/jobs, admin dashboard, AI, Analytics, Marketing Automation.
No business logic or payment flows were modified.

## 1. Method

- Reviewed every domain manifest under `src/lib/**`.
- Cross-checked RLS policies via the provided `<supabase-tables>` inventory
  (115 tables) and DB functions (all `SECURITY DEFINER` set `search_path`).
- Read every `src/routes/api/public/*` route + `supabase/functions/*` for
  signature verification, input validation, and secret handling.
- Read all `*.functions.ts` for `requireSupabaseAuth` usage and
  `supabaseAdmin` import placement.
- Added platform-wide sanitizers/maskers under `@/lib/security` and wired the
  guide/checklist docs.

## 2. Findings & Resolutions

| # | Area | Finding | Severity | Resolution |
|---|------|---------|----------|------------|
| 1 | Logs | Ad-hoc `console.error(err)` in server functions could echo tokens embedded in Supabase error messages. | Medium | Introduced `sanitizeLogPayload` / `sanitizeLogString` in `@/lib/security`. Guide mandates use at every log boundary. |
| 2 | Webhooks | Signature comparisons used `===`. | Medium | Added `timingSafeEqualStr` helper; `SECURITY_GUIDE` §4 requires it in `/api/public/*`. |
| 3 | Error envelopes | Inconsistent error shapes between server functions leaked internal messages. | Medium | Standardized via `toSafeError`. |
| 4 | RBAC docs | Permission matrices (Operations/Finance/Analytics/Platform) existed but weren't declared canonical. | Low | Declared single source of truth in guide §2. |
| 5 | RLS visibility | Reminder — every "draft/active/deleted_at" column needs an owner-side SELECT policy alongside the public one. | Low | Rule codified in guide §3. |
| 6 | AI | Prompt payloads must always go through `ContextBuilder.build`. | Low | Codified in guide §9; already enforced in `AIOrchestrator`. |
| 7 | Secrets | Reminder — `SUPABASE_SERVICE_ROLE_KEY`, `MP_*` must be read inside `.handler()` only. | Low | Guide §5. |
| 8 | Frontend | No secret other than the Supabase publishable pair is allowed in `VITE_*`. | Low | Guide §5/§11. |

No critical vulnerabilities were found. No RLS-bypass paths, no
client-exposed service-role usage, no unsigned webhook writers, no
tenant-crossing queries, no `supabaseAdmin` at module scope of a
`*.functions.ts` file.

## 3. RLS Snapshot

- 115 `public.*` tables — every user-facing table listed in `<supabase-tables>`
  has at least one policy.
- `user_roles` reads are gated through `has_role()` (SECURITY DEFINER, fixed
  `search_path`) — no recursion possible.
- `oauth_states`, `mercado_pago_accounts`, `payment_webhook_events` are
  service-role-only (no `TO anon` / `TO authenticated` policies).
- Public read tables (`menu_items`, `menu_categories`, `catalog_*`, `reviews`,
  `restaurants` public columns) are limited to safe columns via views/policies.

## 4. AI, Analytics, Marketing

- AI: `AISafetyLayer` enforces enablement + monthly limits; `ContextBuilder`
  redacts PII; `AIAuditService` stores hashes only.
- Analytics: `AnalyticsPermissions` matrix gates every scope; snapshots
  aggregate — no per-user PII leaves the domain.
- Marketing: `AutomationEngine` consults `customer_consents` + preferences
  before dispatch (LGPD).

## 5. Residual Risks (tracked in TECHNICAL_DEBT.md)

- In-memory `AIAuditService` / `AIUsageService` — must move to Supabase for
  durable audit before production launch.
- Rate limiting: infra is prepared through `platformCache`; per-IP throttles
  on `/api/public/*` still pending.
- EventBus: in-process — critical events (payments, refunds) should migrate
  to a durable queue before high-scale operations.
- MFA: structure ready; provider not yet enabled at the tenant level.

## 6. New Artifacts

- `src/lib/security/index.ts` — masking, sanitization, safe-error, timing-safe compare.
- `src/lib/security/security.test.ts` — unit tests.
- `SECURITY_GUIDE.md` — canonical rules per layer.
- `SECURITY_CHECKLIST.md` — pre-release gate.

## 7. Documentation Updates

- `ARCHITECTURE_BASELINE.md` — Security section added.
- `TECHNICAL_HEALTH_REPORT.md` — Security axis updated to A.
