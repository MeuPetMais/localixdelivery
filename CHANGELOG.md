# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Preparação profissional para GitHub: `.gitignore`, `README`, `CONTRIBUTING`, `CHANGELOG`, `LICENSE`, `ROADMAP`.
- Pipeline CI (`.github/workflows/ci.yml`): lint, typecheck, testes, build.
- Reorganização da documentação em `docs/`.

## [1.0.0-rc2] - 2026-07-06

### Security
- **RC2-SEC-001**: bloqueio de OAuth para parceiros e admins via triggers de DB (`enforce_partner_email_only`, `enforce_role_email_only`) e guards de rota.

## [1.0.0-rc1] - 2026-07-06

### Added
- **Stripe Connect Express**: onboarding por restaurante, sync de status, capabilities.
- **Split automático** via `transfer_data.destination` e `application_fee_amount` dinâmico.
- **Platform Revenue Domain**: fonte única de monetização (`PlatformRevenueService`).
- Auditoria completa Release Candidate (`GO_LIVE_AUDIT.md`, `GO_LIVE_SCORE.md`, `PRODUCTION_READINESS.md`).

### Changed
- `PricingEngine` consome `PlatformRevenueService` (zero valores hardcoded).

## [0.9.0] - 2026-06

### Added
- Multi-tenant por slug `/{slug}` com `RestaurantSessionContext`.
- Loyalty transacional com dedupe.
- Ledger append-only.
- Order state machine.
- Painéis: dashboard, financeiro, cozinha, delivery, marketplace.
