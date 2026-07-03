# Security Guide — Localix Platform

Practical rules every domain must follow. No business-logic changes belong here.
For the audit snapshot see `SECURITY_AUDIT_REPORT.md`; for the recurring
pre-release gate see `SECURITY_CHECKLIST.md`.

## 1. Authentication

- Sessions live in Supabase Auth (`localStorage`, silent refresh). The client
  is the only place `supabase.auth.*` runs.
- Protected routes: place under `src/routes/_authenticated/` — the managed
  `ssr: false` layout gates the subtree. Never author a second gate.
- Server functions that need the caller identity MUST use
  `requireSupabaseAuth`. The middleware validates the bearer token
  (`getClaims`) — do not trust `getSession()` on the server.
- OAuth `redirect_uri` MUST be a public same-origin URL. Store the intended
  post-login path separately (`sessionStorage` / query param).
- Password reset flows must land on `/redefinir-senha` and call
  `supabase.auth.updateUser({ password })`.
- MFA readiness: no code assumes single-factor. The auth wrapper reads
  `data.claims` from `getClaims`, which already carries AAL/AMR when MFA is
  enabled server-side — no client refactor needed to turn it on.

## 2. Authorization & RBAC

- Roles live in `public.user_roles` and are checked via `public.has_role()`
  (SECURITY DEFINER). Never store `role` on `profiles` / `customer_profiles`.
- Domain permission matrices are the ONLY source of truth for UI gating:
  - `OperationsPermissions`, `FinancePermissions`, `AnalyticsPermissions`,
    `PlatformPermissionRegistry`, `OrderPermissions`.
- Least privilege: every new server function must state which role/permission
  it requires and re-check inside `.handler()`. Signed-in ≠ authorized.
- Admin/service-role code must first verify the caller
  (`context.supabase.rpc('has_role', { _user_id, _role: 'admin' })`) BEFORE
  importing `supabaseAdmin`.

## 3. RLS (Row-Level Security)

- Every `public.*` table MUST have RLS enabled + explicit GRANTs. `anon`
  gets `SELECT` only when a policy is scoped to public data.
- Tenant isolation: user-owned tables filter by `auth.uid()` directly;
  restaurant-owned tables filter through `restaurants.owner_id = auth.uid()`
  or `has_role(auth.uid(), 'platform_admin')`.
- Public read paths (menus, catalog, reviews) use narrow `TO anon` SELECT
  policies with safe columns only. Never use `supabaseAdmin` for public reads.
- Any visibility-gating column (draft/published, active, deleted_at) MUST
  ship an owner-side SELECT policy in the same migration as the public one.
- Recursion: policies calling the same table must go through a SECURITY
  DEFINER function (see `has_role`).

## 4. Edge Functions / Server Functions / API Routes

- App-internal logic → `createServerFn` (auth via `requireSupabaseAuth`).
- Webhooks / public callbacks → `src/routes/api/public/*`. MUST:
  1. Verify signature with `timingSafeEqualStr` from `@/lib/security`.
  2. Validate body with Zod before any DB write.
  3. Return standardized envelopes via `toSafeError`.
  4. Load `supabaseAdmin` inside the handler with dynamic `import()`.
- Timeouts: any outbound `fetch` in a handler must set an `AbortSignal.timeout`.
- Rate limiting: hook is prepared via `platformCache` (per-IP counters); when
  a limiter is enabled it goes here — the codepath is already single-source.

## 5. Secrets & Environment

- Client-visible: only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_SUPABASE_PROJECT_ID`. Anything else = server-only.
- `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`,
  `MP_TOKEN_ENC_KEY`, `LOVABLE_API_KEY` must be read inside `.handler()` —
  never at module scope of a `*.functions.ts` file.
- No secret is ever logged, returned to the browser, or embedded in error
  messages. Use `sanitizeLogString` at the log boundary.

## 6. APIs & Input Validation

- Every server function `.inputValidator()` runs a Zod schema. No `any` in
  and no unchecked `data.*` reads.
- Reject unknown fields explicitly (`z.object({...}).strict()` for privileged
  operations).
- Always project safe columns explicitly in Supabase queries — never `select("*")`
  on tables that hold PII/tokens.

## 7. Logging

- Use `sanitizeLogPayload` before `console.*` inside server functions/handlers.
- Never log: passwords, tokens, JWTs, card numbers, CPF/CNPJ, full addresses,
  or Mercado Pago access tokens.
- Financial amounts may be logged; account/PIX identifiers must be masked with
  `maskString`.

## 8. LGPD

- Consent lives in `customer_consents` + `customer_communication_preferences`.
  Any marketing send MUST check both before dispatch.
- Personal data columns: `customer_profiles`, `customers`, `customer_addresses`,
  `owner_profiles`. All are RLS-scoped to `auth.uid()` + admin.
- Retention: soft-delete via `deleted_at` where present; audit tables are
  append-only (see `product_versions` immutability trigger).
- Export/delete rights: implemented through `customer-area.functions.ts`
  authenticated endpoints — those are the only public entry points.

## 9. AI Platform

- `AISafetyLayer` enforces tenant enablement, skill permission, and monthly
  request/token limits before any provider call.
- `ContextBuilder.sanitize` strips sensitive keys and truncates payloads;
  domains MUST pass through `ContextBuilder.build` — never hand-craft prompts
  from raw DB rows.
- All prompts/responses are hashed in `AIAuditService` (no raw text stored
  once persisted to Supabase).

## 10. EventBus

- Handlers are isolated (`try/catch` in every bus). Failure of one consumer
  never breaks another.
- Payloads MUST NOT carry secrets or raw PII. When cross-domain data is
  needed, pass IDs and let the consumer re-fetch through its Service (RLS
  re-applies).
- Sensitive event types (payment settled, refund, role change) MUST be
  consumed only by domains that already own that permission.

## 11. Frontend

- No secrets in `import.meta.env.VITE_*` other than the Supabase pair.
- No `dangerouslySetInnerHTML` with user content.
- Every form uses Zod + length caps (see `input-validation-security`).
- Sign-out clears cache: `cancelQueries → clear → signOut → navigate(replace)`.

## 12. Performance vs Security

Hardening additions in this pass are pure functions (`@/lib/security`), Zod
validators, and doc/policy checks. No hot-path added > 0.1ms per call.
