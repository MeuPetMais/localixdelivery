-- Gate 4: real PostgreSQL unique/idempotency assertions, synthetic data, rollback.
BEGIN;
INSERT INTO public.financial_ledger(provider,reference_type,reference_id,transaction_type,amount,status,metadata)
VALUES('mercado_pago','mp_payment','gate4-synthetic-mp-payment','PAYMENT_APPROVED',50,'COMPLETED','{"ledger_idempotency_key":"mp:gate4-synthetic:approved"}'::jsonb);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.financial_ledger(provider,reference_type,reference_id,transaction_type,amount,status,metadata)
    VALUES('mercado_pago','mp_payment','gate4-synthetic-mp-payment','PAYMENT_APPROVED',50,'COMPLETED','{"ledger_idempotency_key":"mp:gate4-synthetic:approved"}'::jsonb);
    RAISE EXCEPTION 'FINANCIAL_DUPLICATE_NOT_BLOCKED';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
INSERT INTO public.payment_webhook_events(provider,event_id,resource_id,payload_json)
VALUES ('mercado_pago','gate4-synthetic-event','gate4-synthetic-mp-payment','{}'::jsonb);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.payment_webhook_events(provider,event_id,resource_id,payload_json)
    VALUES ('mercado_pago','gate4-synthetic-event','gate4-synthetic-mp-payment','{}'::jsonb);
    RAISE EXCEPTION 'WEBHOOK_DUPLICATE_NOT_BLOCKED';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
SELECT
 (SELECT count(*) FROM public.financial_ledger WHERE reference_id='gate4-synthetic-mp-payment') AS payment_ledger_entries,
 (SELECT count(*) FROM public.payment_webhook_events WHERE event_id='gate4-synthetic-event') AS webhook_events,
 has_table_privilege('anon','public.financial_ledger','INSERT') AS anon_can_insert_ledger,
 has_table_privilege('authenticated','public.payment_webhook_events','INSERT') AS authenticated_can_insert_webhook;
ROLLBACK;
