
CREATE OR REPLACE FUNCTION public.loyalty_apply(
  _customer_id uuid, _restaurant_id uuid, _tx_type text, _points integer,
  _source text, _reference_type text, _reference_id uuid,
  _description text, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_before int;
  v_after  int;
  v_tx_id  uuid;
BEGIN
  IF _points = 0 THEN RETURN NULL; END IF;

  INSERT INTO public.customer_loyalty (customer_id, restaurant_id, points_balance, lifetime_points)
  VALUES (_customer_id, _restaurant_id, GREATEST(_points,0), GREATEST(_points,0))
  ON CONFLICT (customer_id, restaurant_id) DO NOTHING;

  SELECT points_balance INTO v_before
    FROM public.customer_loyalty
   WHERE customer_id = _customer_id AND restaurant_id = _restaurant_id
   FOR UPDATE;

  v_after := v_before + _points;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient loyalty points (have %, need %)', v_before, -_points
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.customer_loyalty
     SET points_balance  = v_after,
         lifetime_points = lifetime_points + GREATEST(_points, 0),
         updated_at = now()
   WHERE customer_id = _customer_id AND restaurant_id = _restaurant_id;

  -- Idempotência: bate no índice único parcial uq_loyalty_tx_order_source
  -- (customer_id, reference_id, source) WHERE reference_type='order' AND reference_id IS NOT NULL
  IF _reference_type = 'order' AND _reference_id IS NOT NULL THEN
    INSERT INTO public.loyalty_transactions
      (customer_id, restaurant_id, transaction_type, points,
       source, reference_type, reference_id, description, metadata,
       balance_before, balance_after)
    VALUES
      (_customer_id, _restaurant_id, _tx_type, _points,
       _source, _reference_type, _reference_id, _description, COALESCE(_metadata,'{}'::jsonb),
       v_before, v_after)
    ON CONFLICT (customer_id, reference_id, source)
      WHERE reference_type = 'order' AND reference_id IS NOT NULL
      DO NOTHING
    RETURNING id INTO v_tx_id;

    -- Se conflitou (já aplicado antes), reverte o delta
    IF v_tx_id IS NULL THEN
      UPDATE public.customer_loyalty
         SET points_balance  = v_before,
             lifetime_points = lifetime_points - GREATEST(_points, 0),
             updated_at = now()
       WHERE customer_id = _customer_id AND restaurant_id = _restaurant_id;
    END IF;
  ELSE
    INSERT INTO public.loyalty_transactions
      (customer_id, restaurant_id, transaction_type, points,
       source, reference_type, reference_id, description, metadata,
       balance_before, balance_after)
    VALUES
      (_customer_id, _restaurant_id, _tx_type, _points,
       _source, _reference_type, _reference_id, _description, COALESCE(_metadata,'{}'::jsonb),
       v_before, v_after)
    RETURNING id INTO v_tx_id;
  END IF;

  RETURN v_tx_id;
END;
$fn$;
