#!/usr/bin/env bash
# Gate 4: PostgreSQL real, duas sessões concorrentes, somente dados sintéticos.
set -euo pipefail

container="localix-gate4-$$"
tmpdir="$(mktemp -d)"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$tmpdir"; }
trap cleanup EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=gate4_test_only postgres:17 >/dev/null
db() { docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
for attempt in $(seq 1 40); do
  if docker exec "$container" pg_isready -q -U postgres; then break; fi
  sleep 1
done
docker exec "$container" pg_isready -q -U postgres

db <<'SQL'
CREATE TABLE payment_event_queue (
  id text PRIMARY KEY, status text NOT NULL DEFAULT 'pending',
  locked boolean NOT NULL DEFAULT false,
  retry_count integer NOT NULL DEFAULT 0,
  next_retry timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE payment_webhook_events (
  id text PRIMARY KEY, processed boolean NOT NULL DEFAULT false,
  processing_attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER touch_queue BEFORE UPDATE ON payment_event_queue
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_event BEFORE UPDATE ON payment_webhook_events
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
INSERT INTO payment_event_queue(id) VALUES ('q1');
INSERT INTO payment_webhook_events(id,updated_at)
VALUES ('e1',clock_timestamp()-interval '5 minutes');

CREATE TABLE financial_ledger (
 id text PRIMARY KEY, provider text NOT NULL, reference_type text,
 reference_id text, transaction_type text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX financial_ledger_mp_idempotency_uidx
 ON financial_ledger(provider,reference_type,reference_id,transaction_type)
 WHERE provider='mercado_pago' AND reference_type IS NOT NULL
   AND reference_id IS NOT NULL AND metadata ? 'ledger_idempotency_key';
SQL

# Two independent SQL sessions contend on the same row. First transaction
# retains row lock for 2 seconds. Second must re-evaluate locked=false.
docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres   -c "BEGIN; UPDATE payment_event_queue SET locked=true WHERE id='q1' AND status='pending' AND locked=false AND retry_count=0 RETURNING id; SELECT pg_sleep(2); COMMIT;"   >"$tmpdir/queue-first" 2>&1 &
first=$!
sleep 0.5
docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres   -c "UPDATE payment_event_queue SET locked=true WHERE id='q1' AND status='pending' AND locked=false AND retry_count=0 RETURNING id;"   >"$tmpdir/queue-second" 2>&1 &
second=$!
wait "$first"
wait "$second"
test "$(grep -cx 'q1' "$tmpdir/queue-first" || true)" = 1
test "$(grep -cx 'q1' "$tmpdir/queue-second" || true)" = 0
echo "PASS: two PostgreSQL sessions, only one queue claim"

# Independent event CAS under real row locks.
docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres   -c "BEGIN; UPDATE payment_webhook_events SET processing_attempts=1 WHERE id='e1' AND processed=false AND processing_attempts=0 AND updated_at < clock_timestamp()-interval '3 minutes' RETURNING id; SELECT pg_sleep(2); COMMIT;"   >"$tmpdir/event-first" 2>&1 &
first=$!
sleep 0.5
docker exec "$container" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres   -c "UPDATE payment_webhook_events SET processing_attempts=1 WHERE id='e1' AND processed=false AND processing_attempts=0 AND updated_at < clock_timestamp()-interval '3 minutes' RETURNING id;"   >"$tmpdir/event-second" 2>&1 &
second=$!
wait "$first"
wait "$second"
test "$(grep -cx 'e1' "$tmpdir/event-first" || true)" = 1
test "$(grep -cx 'e1' "$tmpdir/event-second" || true)" = 0
echo "PASS: two PostgreSQL sessions, only one event CAS"

# Reclaim and fence: the original lease timestamp can never finalize the
# replacement lease. Then verify duplicate ledger references fail in SQL.
db <<'SQL'
DO $$
DECLARE initial_lease timestamptz; touched integer; current_lease timestamptz;
BEGIN
  SELECT updated_at INTO initial_lease FROM payment_event_queue WHERE id='q1';
  UPDATE payment_event_queue SET locked=false WHERE id='q1';
  UPDATE payment_event_queue SET locked=true WHERE id='q1' AND locked=false;
  SELECT updated_at INTO current_lease FROM payment_event_queue WHERE id='q1';
  IF initial_lease=current_lease THEN RAISE EXCEPTION 'lease timestamp unchanged'; END IF;
  UPDATE payment_event_queue SET locked=false,status='completed'
    WHERE id='q1' AND locked=true AND retry_count=0 AND updated_at=initial_lease;
  GET DIAGNOSTICS touched=ROW_COUNT;
  IF touched<>0 THEN RAISE EXCEPTION 'stale worker finalized newer lease'; END IF;
  UPDATE payment_event_queue SET locked=false,status='completed'
    WHERE id='q1' AND locked=true AND retry_count=0 AND updated_at=current_lease;
  GET DIAGNOSTICS touched=ROW_COUNT;
  IF touched<>1 THEN RAISE EXCEPTION 'current worker unable to finalize'; END IF;
END $$;

INSERT INTO financial_ledger(id,provider,reference_type,reference_id,transaction_type,metadata)
VALUES ('one','mercado_pago','mp_payment','capture-1','PAYMENT_APPROVED',
        '{"ledger_idempotency_key":"mp_payment:capture-1:PAYMENT_APPROVED"}');
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    INSERT INTO financial_ledger(id,provider,reference_type,reference_id,transaction_type,metadata)
    VALUES ('two','mercado_pago','mp_payment','capture-1','PAYMENT_APPROVED',
            '{"ledger_idempotency_key":"mp_payment:capture-1:PAYMENT_APPROVED"}');
  EXCEPTION WHEN unique_violation THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'duplicate capture inserted'; END IF;
  IF (SELECT count(*) FROM financial_ledger)<>1 THEN
    RAISE EXCEPTION 'unexpected ledger row count';
  END IF;
END $$;
SQL
echo "PASS: stale worker fenced and duplicate financial reference rejected"
