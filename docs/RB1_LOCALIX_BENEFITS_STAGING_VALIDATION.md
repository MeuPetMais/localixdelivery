# RB-1 Localix Benefits — Staging validation

Status: staging-only. Production untouched.

Validated in Supabase staging:
- core schema and RLS
- service_role-only financial RPC execution
- grant/reserve/release/redeem/reverse flow
- idempotency
- negative cases: benefits disabled, paused campaign, customer grant limit, minimum order, insufficient balance
- real concurrency with two independent pg_cron sessions against the same R$5 credit

Concurrency evidence (2026-09-03):
- job A started at 16:52:00.082905 UTC and failed with `INSUFFICIENT_BALANCE`
- job B started at 16:52:00.084440 UTC and succeeded
- only one reservation of R$5 was created
- final credit state before cleanup: available=0, reserved=5
- repeated minute confirmed the same deterministic outcome via idempotency/row locking

Migration reconciliation:
- GitHub migrations versioned on branch `feat/rb1-localix-benefits-foundation`
- staging migration history contains `rb1_localix_benefits_staging_reconciliation`
- the reconciliation entry is a marker because the schema was applied and validated before repository versioning

Cleanup:
- cron jobs unscheduled
- test campaign, credit and reservations removed
- `localix_benefits_enabled=false` restored

Release conclusion:
RB-1 staging gate passed. Production deployment remains a separate controlled gate.
