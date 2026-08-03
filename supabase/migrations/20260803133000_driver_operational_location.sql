-- Operational driver location: current position only, no coordinate history.

ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS last_accuracy DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_heading DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_speed DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_location_device_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_location_server_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_confidence TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (location_confidence IN ('HIGH','MEDIUM','LOW'));

ALTER TABLE public.tracking_snapshots
  ADD COLUMN IF NOT EXISTS last_accuracy DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS device_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS server_received_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_location_restaurant
  ON public.delivery_drivers(restaurant_id, last_location_server_at DESC)
  WHERE last_lat IS NOT NULL AND last_lng IS NOT NULL;

DROP POLICY IF EXISTS "Customer reads own tracking snapshot" ON public.tracking_snapshots;
CREATE POLICY "Customer reads own active tracking snapshot"
  ON public.tracking_snapshots
  FOR SELECT TO authenticated
  USING (
    status IN ('ATRIBUIDO','COLETANDO','EM_ROTA','PROXIMO_AO_DESTINO')
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = tracking_snapshots.order_id
        AND o.customer_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.driver_location_distance_meters(
  _lat1 DOUBLE PRECISION,
  _lng1 DOUBLE PRECISION,
  _lat2 DOUBLE PRECISION,
  _lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _lat1 IS NULL OR _lng1 IS NULL OR _lat2 IS NULL OR _lng2 IS NULL THEN NULL
    ELSE 6371000 * 2 * asin(least(1, sqrt(
      pow(sin(radians((_lat2 - _lat1) / 2)), 2) +
      cos(radians(_lat1)) * cos(radians(_lat2)) *
      pow(sin(radians((_lng2 - _lng1) / 2)), 2)
    )))
  END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_driver_operational_location(
  _driver_id UUID,
  _restaurant_id UUID,
  _assignment_id UUID,
  _lat DOUBLE PRECISION,
  _lng DOUBLE PRECISION,
  _accuracy DOUBLE PRECISION,
  _heading DOUBLE PRECISION,
  _speed DOUBLE PRECISION,
  _device_captured_at TIMESTAMPTZ,
  _correlation_id UUID DEFAULT gen_random_uuid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver RECORD;
  v_assignment RECORD;
  v_shift RECORD;
  v_now TIMESTAMPTZ := now();
  v_age_seconds DOUBLE PRECISION;
  v_future_seconds DOUBLE PRECISION;
  v_distance DOUBLE PRECISION;
  v_elapsed DOUBLE PRECISION;
  v_derived_speed DOUBLE PRECISION;
  v_min_interval INTEGER := 60;
  v_min_distance INTEGER := 100;
  v_confidence TEXT := 'HIGH';
  v_reasons TEXT[] := ARRAY[]::TEXT[];
  v_status TEXT := 'AVAILABLE';
  v_has_assignment BOOLEAN := FALSE;
BEGIN
  IF _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_COORDINATE');
  END IF;

  SELECT *
    INTO v_driver
    FROM public.delivery_drivers
   WHERE id = _driver_id
   FOR UPDATE;

  IF v_driver.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'DRIVER_NOT_FOUND');
  END IF;
  IF v_driver.owner_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'FORBIDDEN');
  END IF;
  IF v_driver.restaurant_id <> _restaurant_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'DRIVER_NOT_IN_RESTAURANT');
  END IF;
  IF v_driver.status <> 'ativo' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'DRIVER_INACTIVE');
  END IF;
  IF v_driver.online IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'DRIVER_OFFLINE');
  END IF;

  SELECT status, current_state
    INTO v_shift
    FROM public.driver_shifts
   WHERE driver_id = _driver_id
     AND restaurant_id = _restaurant_id
     AND status <> 'FINALIZADO'
   ORDER BY started_at DESC
   LIMIT 1;

  IF v_shift.current_state IN ('PAUSADO','PAUSA') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'DRIVER_PAUSED');
  END IF;

  IF _assignment_id IS NOT NULL THEN
    SELECT *
      INTO v_assignment
      FROM public.delivery_assignments
     WHERE id = _assignment_id
       AND driver_id = _driver_id
       AND restaurant_id = _restaurant_id
       AND status IN ('ATRIBUIDO','COLETANDO','EM_ROTA')
     FOR UPDATE;

    IF v_assignment.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'ASSIGNMENT_NOT_ACTIVE');
    END IF;
    v_has_assignment := TRUE;
    v_min_interval := 15;
    v_min_distance := 25;
    v_status := v_assignment.status;
  END IF;

  v_age_seconds := extract(epoch FROM (v_now - _device_captured_at));
  v_future_seconds := extract(epoch FROM (_device_captured_at - v_now));
  IF v_age_seconds > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'STALE_SAMPLE');
  END IF;
  IF v_future_seconds > 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'FUTURE_SAMPLE');
  END IF;

  IF _accuracy IS NOT NULL AND _accuracy > 100 THEN
    v_confidence := 'MEDIUM';
    v_reasons := array_append(v_reasons, 'LOW_ACCURACY');
  END IF;
  IF _speed IS NOT NULL AND _speed > 33 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'IMPOSSIBLE_SPEED');
  END IF;

  v_distance := public.driver_location_distance_meters(
    v_driver.last_lat, v_driver.last_lng, _lat, _lng
  );
  v_elapsed := CASE
    WHEN v_driver.last_location_device_at IS NULL THEN NULL
    ELSE extract(epoch FROM (_device_captured_at - v_driver.last_location_device_at))
  END;

  IF v_elapsed IS NOT NULL AND v_elapsed < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'OUT_OF_ORDER_SAMPLE');
  END IF;

  IF v_distance IS NOT NULL AND v_elapsed IS NOT NULL THEN
    v_derived_speed := v_distance / greatest(1, v_elapsed);
    IF v_derived_speed > 45 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'IMPOSSIBLE_JUMP');
    END IF;
  END IF;

  IF v_driver.last_location_server_at IS NOT NULL
     AND extract(epoch FROM (v_now - v_driver.last_location_server_at)) < v_min_interval
     AND COALESCE(v_distance, 999999) < v_min_distance THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'RATE_LIMITED',
      'min_interval_seconds', v_min_interval,
      'min_distance_meters', v_min_distance
    );
  END IF;

  UPDATE public.delivery_drivers
     SET last_lat = _lat,
         last_lng = _lng,
         last_accuracy = _accuracy,
         last_heading = _heading,
         last_speed = _speed,
         last_seen_at = v_now,
         last_location_device_at = _device_captured_at,
         last_location_server_at = v_now,
         location_confidence = v_confidence
   WHERE id = _driver_id;

  IF v_has_assignment THEN
    UPDATE public.tracking_snapshots
       SET last_lat = _lat,
           last_lng = _lng,
           last_accuracy = _accuracy,
           last_heading = _heading,
           last_speed = _speed,
           last_seen_at = _device_captured_at,
           device_captured_at = _device_captured_at,
           server_received_at = v_now,
           confidence = v_confidence,
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'location_reasons', v_reasons,
             'location_status', v_status
           )
     WHERE assignment_id = v_assignment.id
       AND driver_id = _driver_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'ACCEPTED',
    'confidence', v_confidence,
    'tracked_assignment', v_has_assignment,
    'correlation_id', _correlation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_driver_operational_location(
  UUID, UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_driver_operational_location(
  UUID, UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ, UUID
) TO authenticated;
