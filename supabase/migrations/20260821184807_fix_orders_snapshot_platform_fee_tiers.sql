CREATE OR REPLACE FUNCTION public.tg_orders_snapshot_platform_fees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until_30 numeric;
  v_above_30 numeric;
  v_fee numeric;
BEGIN
  SELECT
    COALESCE(ps.platform_fee_until_30, 0.99),
    COALESCE(ps.platform_fee_above_30, 1.49)
  INTO v_until_30, v_above_30
  FROM public.platform_settings ps
  WHERE ps.id = true;

  v_until_30 := COALESCE(v_until_30, 0.99);
  v_above_30 := COALESCE(v_above_30, 1.49);

  IF COALESCE(NEW.total, 0) <= 30 THEN
    v_fee := v_until_30;
  ELSE
    v_fee := v_above_30;
  END IF;

  NEW.platform_fee := v_fee;
  NEW.fixed_fee := v_fee;
  NEW.commission_rate := 0;

  RETURN NEW;
END;
$$;
