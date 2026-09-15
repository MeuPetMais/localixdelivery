\set ON_ERROR_STOP on

\if :{?LOCALIX_STAGING_ATOMIC_CHECKOUT_TEST}
\else
\echo 'Refusing to run: pass -v LOCALIX_STAGING_ATOMIC_CHECKOUT_TEST=1 and use the staging database only.'
\quit 3
\endif

BEGIN;

CREATE OR REPLACE FUNCTION public.localix_atomic_checkout_raise_after_order_for_test()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('localix.atomic_checkout_staging_test', true) = 'on'
     AND NEW.customer_phone = current_setting('localix.atomic_checkout_fail_phone', true) THEN
    RAISE EXCEPTION 'LOCALIX_ATOMIC_CHECKOUT_AFTER_ORDER';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.localix_atomic_checkout_raise_after_snapshot_for_test()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('localix.atomic_checkout_staging_test', true) = 'on'
     AND EXISTS (
       SELECT 1
         FROM public.orders o
        WHERE o.id = NEW.order_id
          AND o.customer_phone = current_setting('localix.atomic_checkout_fail_phone', true)
     ) THEN
    RAISE EXCEPTION 'LOCALIX_ATOMIC_CHECKOUT_AFTER_SNAPSHOT';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_restaurant_id uuid;
  v_key text := 'staging-atomic-' || replace(gen_random_uuid()::text, '-', '');
  v_hash text := md5(v_key || ':payload');
  v_order_id uuid;
  v_order_number integer;
  v_reused boolean;
BEGIN
  SELECT id
    INTO v_restaurant_id
    FROM public.restaurants
   WHERE active IS TRUE
   ORDER BY created_at
   LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'No active restaurant available for staging atomic checkout test';
  END IF;

  SELECT order_id, order_number, reused
    INTO v_order_id, v_order_number, v_reused
    FROM public.create_order_with_snapshot_payment(
      v_key,
      v_hash,
      v_restaurant_id,
      NULL,
      'Localix Atomic Staging Test',
      '+550000000001',
      'Rollback Street, 1',
      'pix',
      '[{"id":"staging-item","name":"Atomic test item","quantity":1,"unitPrice":10}]'::jsonb,
      10,
      0,
      0,
      'novo',
      10,
      0,
      0,
      'customer',
      0,
      0,
      0,
      10,
      10,
      0,
      0,
      0,
      10,
      'localix',
      'BRL',
      'mercado_pago',
      'PENDING',
      NULL
    );

  IF v_order_id IS NULL OR v_order_number IS NULL OR v_reused IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Initial atomic checkout insert returned unexpected values';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.order_pricing_snapshot WHERE order_id = v_order_id) THEN
    RAISE EXCEPTION 'Pricing snapshot was not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.order_payment WHERE order_id = v_order_id) THEN
    RAISE EXCEPTION 'Order payment was not created';
  END IF;

  SELECT order_id, order_number, reused
    INTO STRICT v_order_id, v_order_number, v_reused
    FROM public.create_order_with_snapshot_payment(
      v_key,
      v_hash,
      v_restaurant_id,
      NULL,
      'Localix Atomic Staging Test',
      '+550000000001',
      'Rollback Street, 1',
      'pix',
      '[{"id":"staging-item","name":"Atomic test item","quantity":1,"unitPrice":10}]'::jsonb,
      10,
      0,
      0,
      'novo',
      10,
      0,
      0,
      'customer',
      0,
      0,
      0,
      10,
      10,
      0,
      0,
      0,
      10,
      'localix',
      'BRL',
      'mercado_pago',
      'PENDING',
      NULL
    );

  IF v_reused IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Idempotent retry did not reuse the existing order';
  END IF;

  BEGIN
    PERFORM public.create_order_with_snapshot_payment(
      v_key,
      v_hash || '-different',
      v_restaurant_id,
      NULL,
      'Localix Atomic Staging Test',
      '+550000000001',
      'Rollback Street, 1',
      'pix',
      '[]'::jsonb,
      10,
      0,
      0,
      'novo',
      10,
      0,
      0,
      'customer',
      0,
      0,
      0,
      10,
      10,
      0,
      0,
      0,
      10,
      'localix',
      'BRL',
      'mercado_pago',
      'PENDING',
      NULL
    );
    RAISE EXCEPTION 'Divergent idempotency payload did not fail';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;
END;
$$;

CREATE TRIGGER localix_atomic_checkout_raise_after_order_for_test
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.localix_atomic_checkout_raise_after_order_for_test();

DO $$
DECLARE
  v_restaurant_id uuid;
  v_key text := 'staging-atomic-fail-order-' || replace(gen_random_uuid()::text, '-', '');
  v_phone text := '+550000000002';
BEGIN
  SELECT id INTO v_restaurant_id FROM public.restaurants WHERE active IS TRUE ORDER BY created_at LIMIT 1;
  PERFORM set_config('localix.atomic_checkout_staging_test', 'on', true);
  PERFORM set_config('localix.atomic_checkout_fail_phone', v_phone, true);

  BEGIN
    PERFORM public.create_order_with_snapshot_payment(
      v_key,
      md5(v_key),
      v_restaurant_id,
      NULL,
      'Localix Atomic Staging Test',
      v_phone,
      'Rollback Street, 2',
      'pix',
      '[]'::jsonb,
      10,
      0,
      0,
      'novo',
      10,
      0,
      0,
      'customer',
      0,
      0,
      0,
      10,
      10,
      0,
      0,
      0,
      10,
      'localix',
      'BRL',
      'mercado_pago',
      'PENDING',
      NULL
    );
    RAISE EXCEPTION 'Forced after-order failure did not fire';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'LOCALIX_ATOMIC_CHECKOUT_AFTER_ORDER' THEN
        RAISE;
      END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.orders WHERE customer_phone = v_phone)
     OR EXISTS (SELECT 1 FROM public.checkout_order_idempotency WHERE idempotency_key = v_key) THEN
    RAISE EXCEPTION 'After-order failure leaked rows';
  END IF;
END;
$$;

DROP TRIGGER localix_atomic_checkout_raise_after_order_for_test ON public.orders;

CREATE TRIGGER localix_atomic_checkout_raise_after_snapshot_for_test
AFTER INSERT ON public.order_pricing_snapshot
FOR EACH ROW
EXECUTE FUNCTION public.localix_atomic_checkout_raise_after_snapshot_for_test();

DO $$
DECLARE
  v_restaurant_id uuid;
  v_key text := 'staging-atomic-fail-snapshot-' || replace(gen_random_uuid()::text, '-', '');
  v_phone text := '+550000000003';
BEGIN
  SELECT id INTO v_restaurant_id FROM public.restaurants WHERE active IS TRUE ORDER BY created_at LIMIT 1;
  PERFORM set_config('localix.atomic_checkout_staging_test', 'on', true);
  PERFORM set_config('localix.atomic_checkout_fail_phone', v_phone, true);

  BEGIN
    PERFORM public.create_order_with_snapshot_payment(
      v_key,
      md5(v_key),
      v_restaurant_id,
      NULL,
      'Localix Atomic Staging Test',
      v_phone,
      'Rollback Street, 3',
      'pix',
      '[]'::jsonb,
      10,
      0,
      0,
      'novo',
      10,
      0,
      0,
      'customer',
      0,
      0,
      0,
      10,
      10,
      0,
      0,
      0,
      10,
      'localix',
      'BRL',
      'mercado_pago',
      'PENDING',
      NULL
    );
    RAISE EXCEPTION 'Forced after-snapshot failure did not fire';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'LOCALIX_ATOMIC_CHECKOUT_AFTER_SNAPSHOT' THEN
        RAISE;
      END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.orders WHERE customer_phone = v_phone)
     OR EXISTS (SELECT 1 FROM public.checkout_order_idempotency WHERE idempotency_key = v_key) THEN
    RAISE EXCEPTION 'After-snapshot failure leaked rows';
  END IF;
END;
$$;

ROLLBACK;

\echo 'Atomic checkout staging test passed. Transaction rolled back.'
