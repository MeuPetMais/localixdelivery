# RB-1 Localix Benefits — Staging validation

Status: staging-only. Production untouched.

Validated in Supabase staging:
- core schema and RLS
- service_role-only financial RPC execution
- grant/reserve/release/redeem/reverse flow
- idempotency
- negative cases: benefits disabled, paused campaign, customer grant limit, minimum order, insufficient balance

Remaining release gate at time of this note: prove concurrent reserve behavior with independent sessions and reconcile migration history.
