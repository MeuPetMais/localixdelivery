# Security Checklist — Pre-Release Gate

Run before every production deploy. All items must be ✅ or explicitly waived
in `TECHNICAL_DEBT.md`.

## Auth
- [ ] All protected routes live under `src/routes/_authenticated/`.
- [ ] No custom `beforeLoad` `getSession()` gates on top-level SSR routes.
- [ ] OAuth `redirect_uri` = public same-origin URL only.
- [ ] `/redefinir-senha` is public and calls `updateUser({ password })`.

## RBAC / Authorization
- [ ] Every new server function declares a role/permission check inside `.handler()`.
- [ ] UI role checks go through the domain matrix (`*Permissions.ts`), not ad-hoc booleans.
- [ ] `supabaseAdmin` usage is preceded by `has_role(admin)` check.

## RLS
- [ ] Every new `public.*` table ships with GRANT + `ENABLE RLS` + policies in the same migration.
- [ ] `anon` SELECT only for public, safe-column data.
- [ ] Any draft/visibility column has an owner-side SELECT policy.
- [ ] SECURITY DEFINER functions set `search_path = public`.

## Server Functions / Edge / API
- [ ] `.inputValidator()` present with a Zod schema (strict where privileged).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` / `MP_*` read inside `.handler()` only.
- [ ] `supabaseAdmin` loaded via `await import(...)` inside handlers.
- [ ] Webhook handlers verify signature with `timingSafeEqualStr`.
- [ ] All outbound `fetch` calls set an `AbortSignal.timeout`.

## Secrets
- [ ] No secret in `VITE_*` beyond the Supabase publishable pair.
- [ ] No secret hard-coded in source or committed `.env`.
- [ ] No secret in error messages returned to the client.

## Logging
- [ ] `sanitizeLogPayload` used before `console.*` in server code.
- [ ] No JWT, bearer, card, CPF/CNPJ, or PIX key appears in logs.

## LGPD
- [ ] Marketing sends check `customer_consents` + `customer_communication_preferences`.
- [ ] Personal data tables are RLS-scoped to `auth.uid()` + admin.
- [ ] Audit tables are append-only.

## AI
- [ ] Prompts built exclusively through `ContextBuilder.build`.
- [ ] `AISafetyLayer.check` invoked before every provider call.
- [ ] Usage/audit persisted (once storage is durable).

## EventBus
- [ ] Payloads carry IDs, not raw PII or secrets.
- [ ] Sensitive events consumed only by permitted domains.

## Frontend
- [ ] No `dangerouslySetInnerHTML` with user content.
- [ ] Forms use Zod + length caps.
- [ ] Sign-out flow: `cancelQueries → clear → signOut → navigate(replace)`.
