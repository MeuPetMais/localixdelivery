-- Atomic checkout order creation.
-- Keeps orders + immutable pricing snapshot + order_payment in one PostgreSQL transaction.

CREATE TABLE IF NOT EXISTS public.checkout_order_idempotency (
  idempotency_key text PRIMARY KEY,
  payload_hash text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_order_idempotency ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.checkout_order_idempotency FROM PUBLIC;
REVOKE ALL ON public.checkout_order_idempotency FROM anon;
REVOKE ALL ON public.checkout_order_idempotency FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkout_order_idempotency TO service_role;

CREATE OR REPLACE FUNCTION public.create_order_with_snapshot_payment(
  _idempotency_key text,
  _payload_hash text,
  _restaurant_id uuid,
  _customer_id uuid,
  _customer_name text,
  _customer_phone text,
  _address text,
  _payment_method text,
  _items jsonb,
  _total numeric,
  _discount numeric,
  _loyalty_discount numeric,
  _status text,
  _snapshot_subtotal numeric,
  _snapshot_delivery_fee numeric,
  _snapshot_platform_fee numeric,
  _snapshot_service_fee_payer text,
  _snapshot_gateway_fee numeric,
  _snapshot_coupon_discount numeric,
  _snapshot_cashback numeric,
  _snapshot_restaurant_gross numeric,
  _snapshot_restaurant_net numeric,
  _snapshot_platform_revenue numeric,
  _snapshot_realized_platform_revenue numeric,
  _snapshot_gateway_revenue numeric,
  _snapshot_customer_total numeric,
  _snapshot_provider text,
  _snapshot_currency text,
  _payment_provider text,
  _payment_status text,
  _payment_external_reference text DEFAULT NULL
)
RETURNS TABLE(order_id uuid, order_number integer, reused boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_existing public.checkout_order_idempotency%ROWTYPE;
  v_order_id uuid;
  v_order_number integer;
BEGIN
  IF nullif(btrim(_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF nullif(btrim(_payload_hash), '') IS NULL THEN
    RAISE EXCEPTION 'PAYLOAD_HASH_REQUIRED' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_idempotency_key, 0));

  SELECT *
    INTO v_existing
    FROM public.checkout_order_idempotency
   WHERE checkout_order_idempotency.idempotency_key = _idempotency_key
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.payload_hash <> _payload_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;

    RETURN QUERY
      SELECT o.id, o.order_number, true
        FROM public.orders o
       WHERE o.id = v_existing.order_id;
    RETURN;
  END IF;

  INSERT INTO public.orders (
    restaurant_id,
    customer_id,
    customer_name,
    customer_phone,
    address,
    payment_method,
    items,
    total,
    discount,
    loyalty_discount,
    status
  )
  VALUES (
    _restaurant_id,
    _customer_id,
    _customer_name,
    _customer_phone,
    _address,
    _payment_method,
    coalesce(_items, '[]'::jsonb),
    _total,
    coalesce(_discount, 0),
    coalesce(_loyalty_discount, 0),
    _status
  )
  RETURNING id, orders.order_number
    INTO v_order_id, v_order_number;

  INSERT INTO public.order_pricing_snapshot (
    order_id,
    subtotal,
    delivery_fee,
    platform_fee,
    service_fee_payer,
    gateway_fee,
    coupon_discount,
    cashback,
    restaurant_gross,
    restaurant_net,
    platform_revenue,
    realized_platform_revenue,
    gateway_revenue,
    customer_total,
    provider,
    currency
  )
  VALUES (
    v_order_id,
    _snapshot_subtotal,
    coalesce(_snapshot_delivery_fee, 0),
    coalesce(_snapshot_platform_fee, 0),
    _snapshot_service_fee_payer,
    coalesce(_snapshot_gateway_fee, 0),
    coalesce(_snapshot_coupon_discount, 0),
    coalesce(_snapshot_cashback, 0),
    coalesce(_snapshot_restaurant_gross, 0),
    coalesce(_snapshot_restaurant_net, 0),
    coalesce(_snapshot_platform_revenue, 0),
    coalesce(_snapshot_realized_platform_revenue, 0),
    coalesce(_snapshot_gateway_revenue, 0),
    _snapshot_customer_total,
    _snapshot_provider,
    _snapshot_currency
  );

  INSERT INTO public.order_payment (
    order_id,
    restaurant_id,
    provider,
    payment_method,
    status,
    external_reference
  )
  VALUES (
    v_order_id,
    _restaurant_id,
    coalesce(_payment_provider, 'mercado_pago'),
    _payment_method,
    _payment_status,
    coalesce(_payment_external_reference, v_order_id::text)
  );

  INSERT INTO public.checkout_order_idempotency (
    idempotency_key,
    payload_hash,
    order_id
  )
  VALUES (
    _idempotency_key,
    _payload_hash,
    v_order_id
  );

  RETURN QUERY SELECT v_order_id, v_order_number, false;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_snapshot_payment(
  text, text, uuid, uuid, text, text, text, text, jsonb, numeric, numeric, numeric, text,
  numeric, numeric, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, text, text, text, text, text
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order_with_snapshot_payment(
  text, text, uuid, uuid, text, text, text, text, jsonb, numeric, numeric, numeric, text,
  numeric, numeric, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, text, text, text, text, text
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_order_with_snapshot_payment(
  text, text, uuid, uuid, text, text, text, text, jsonb, numeric, numeric, numeric, text,
  numeric, numeric, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, text, text, text, text, text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_snapshot_payment(
  text, text, uuid, uuid, text, text, text, text, jsonb, numeric, numeric, numeric, text,
  numeric, numeric, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, text, text, text, text, text
) TO service_role;
