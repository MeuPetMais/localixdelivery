-- Harden delivery queue FIFO semantics per restaurant.
-- Reuses public.delivery_queue and canonical queue_* RPCs.

CREATE TABLE IF NOT EXISTS public.delivery_queue_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID,
  restaurant_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'ENTER','LEAVE','DEQUEUE','RETURN_STARTED','RETURN_FINISHED','REPOSITION','IDEMPOTENT'
  )),
  previous_status public.delivery_queue_status,
  current_status public.delivery_queue_status,
  previous_position INTEGER,
  current_position INTEGER,
  actor_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_queue_audit_restaurant_idx
  ON public.delivery_queue_audit(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_queue_audit_driver_idx
  ON public.delivery_queue_audit(driver_id, created_at DESC);

GRANT SELECT, INSERT ON public.delivery_queue_audit TO authenticated;
GRANT ALL ON public.delivery_queue_audit TO service_role;

ALTER TABLE public.delivery_queue_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own queue audit" ON public.delivery_queue_audit;
CREATE POLICY "Owners read own queue audit"
  ON public.delivery_queue_audit FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = delivery_queue_audit.restaurant_id AND r.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Drivers read own queue audit" ON public.delivery_queue_audit;
CREATE POLICY "Drivers read own queue audit"
  ON public.delivery_queue_audit FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_drivers d
    WHERE d.id = delivery_queue_audit.driver_id AND d.owner_id = auth.uid()
  ));

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY restaurant_id
    ORDER BY position ASC, entered_at ASC, id ASC
  ) AS next_position
  FROM public.delivery_queue
  WHERE status = 'AGUARDANDO'
)
UPDATE public.delivery_queue q
SET position = ranked.next_position
FROM ranked
WHERE q.id = ranked.id;

DROP INDEX IF EXISTS delivery_queue_waiting_position_uniq;
CREATE UNIQUE INDEX delivery_queue_waiting_position_uniq
  ON public.delivery_queue (restaurant_id, position)
  WHERE status = 'AGUARDANDO';

CREATE OR REPLACE FUNCTION public.queue_audit_insert(
  _queue_id UUID,
  _restaurant_id UUID,
  _driver_id UUID,
  _action TEXT,
  _previous_status public.delivery_queue_status,
  _current_status public.delivery_queue_status,
  _previous_position INTEGER,
  _current_position INTEGER,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.delivery_queue_audit (
    queue_id, restaurant_id, driver_id, action,
    previous_status, current_status,
    previous_position, current_position,
    actor_id, metadata
  ) VALUES (
    _queue_id, _restaurant_id, _driver_id, _action,
    _previous_status, _current_status,
    _previous_position, _current_position,
    auth.uid(), COALESCE(_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_reposition_after(
  _restaurant_id UUID,
  _position INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH moved AS (
    UPDATE public.delivery_queue
       SET position = position - 1
     WHERE restaurant_id = _restaurant_id
       AND status = 'AGUARDANDO'
       AND position > _position
     RETURNING id, restaurant_id, driver_id, position + 1 AS previous_position, position AS current_position
  )
  INSERT INTO public.delivery_queue_audit (
    queue_id, restaurant_id, driver_id, action,
    previous_status, current_status,
    previous_position, current_position,
    actor_id, metadata
  )
  SELECT
    id, restaurant_id, driver_id, 'REPOSITION',
    'AGUARDANDO', 'AGUARDANDO',
    previous_position, current_position,
    auth.uid(), '{}'::jsonb
  FROM moved;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_assert_driver_can_wait(
  _restaurant_id UUID,
  _driver_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver RECORD;
  v_paused BOOLEAN;
  v_active_assignment BOOLEAN;
BEGIN
  SELECT id, restaurant_id, status, online
    INTO v_driver
    FROM public.delivery_drivers
   WHERE id = _driver_id
   FOR UPDATE;

  IF v_driver.id IS NULL OR v_driver.restaurant_id <> _restaurant_id THEN
    RAISE EXCEPTION 'DRIVER_NOT_IN_RESTAURANT';
  END IF;
  IF v_driver.status <> 'ativo' THEN
    RAISE EXCEPTION 'DRIVER_INACTIVE';
  END IF;
  IF NOT v_driver.online THEN
    RAISE EXCEPTION 'DRIVER_OFFLINE';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.driver_shifts s
    WHERE s.driver_id = _driver_id
      AND s.status <> 'FINALIZADO'
      AND (s.status = 'PAUSADO' OR s.current_state IN ('PAUSA','EM_ENTREGA','RETORNANDO'))
  ) INTO v_paused;
  IF v_paused THEN
    RAISE EXCEPTION 'DRIVER_UNAVAILABLE';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.delivery_assignments a
    WHERE a.driver_id = _driver_id
      AND a.status IN ('ATRIBUIDO','COLETANDO','EM_ROTA')
  ) INTO v_active_assignment;
  IF v_active_assignment THEN
    RAISE EXCEPTION 'DRIVER_HAS_ACTIVE_ASSIGNMENT';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_enqueue(_restaurant_id UUID, _driver_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_driver RECORD;
  v_blocked BOOLEAN;
  v_active_assignment BOOLEAN;
  v_id UUID;
  v_pos INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant_id::text));

  SELECT * INTO v_existing
    FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id
     AND driver_id = _driver_id
     AND status <> 'INATIVO'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    PERFORM public.queue_audit_insert(
      v_existing.id, _restaurant_id, _driver_id, 'IDEMPOTENT',
      v_existing.status, v_existing.status,
      v_existing.position, v_existing.position,
      jsonb_build_object('operation','queue_enqueue')
    );
    RETURN v_existing.id;
  END IF;

  SELECT id, restaurant_id, status, online
    INTO v_driver
    FROM public.delivery_drivers
   WHERE id = _driver_id
   FOR UPDATE;

  IF v_driver.id IS NULL OR v_driver.restaurant_id <> _restaurant_id THEN
    RAISE EXCEPTION 'DRIVER_NOT_IN_RESTAURANT';
  END IF;
  IF v_driver.status <> 'ativo' THEN
    RAISE EXCEPTION 'DRIVER_INACTIVE';
  END IF;
  IF NOT v_driver.online THEN
    RAISE EXCEPTION 'DRIVER_OFFLINE';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.driver_shifts s
    WHERE s.driver_id = _driver_id
      AND s.status <> 'FINALIZADO'
      AND (s.status = 'PAUSADO' OR s.current_state IN ('PAUSA','EM_ENTREGA'))
  ) INTO v_blocked;
  IF v_blocked THEN
    RAISE EXCEPTION 'DRIVER_UNAVAILABLE';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.delivery_assignments a
    WHERE a.driver_id = _driver_id
      AND a.status IN ('ATRIBUIDO','COLETANDO','EM_ROTA')
  ) INTO v_active_assignment;
  IF v_active_assignment THEN
    RAISE EXCEPTION 'DRIVER_HAS_ACTIVE_ASSIGNMENT';
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1
    INTO v_pos
    FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id
     AND status = 'AGUARDANDO';

  INSERT INTO public.delivery_queue (restaurant_id, driver_id, position, status, entered_at)
  VALUES (_restaurant_id, _driver_id, v_pos, 'AGUARDANDO', now())
  RETURNING id INTO v_id;

  PERFORM public.queue_audit_insert(v_id, _restaurant_id, _driver_id, 'ENTER', NULL, 'AGUARDANDO', NULL, v_pos);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_dequeue(_restaurant_id UUID, _driver_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant_id::text));

  SELECT * INTO v_row
    FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id
     AND driver_id = _driver_id
     AND status <> 'INATIVO'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN false;
  END IF;
  IF v_row.status = 'EM_ENTREGA' THEN
    PERFORM public.queue_audit_insert(
      v_row.id, _restaurant_id, _driver_id, 'IDEMPOTENT',
      v_row.status, v_row.status, v_row.position, v_row.position,
      jsonb_build_object('operation','queue_dequeue')
    );
    RETURN true;
  END IF;
  IF v_row.status <> 'AGUARDANDO' THEN
    RETURN false;
  END IF;

  UPDATE public.delivery_queue
     SET status = 'EM_ENTREGA', position = 0, left_at = now()
   WHERE id = v_row.id;

  PERFORM public.queue_audit_insert(v_row.id, _restaurant_id, _driver_id, 'DEQUEUE', 'AGUARDANDO', 'EM_ENTREGA', v_row.position, 0);
  PERFORM public.queue_reposition_after(_restaurant_id, v_row.position);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_start_return(_restaurant_id UUID, _driver_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant_id::text));

  SELECT * INTO v_row
    FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id
     AND driver_id = _driver_id
     AND status <> 'INATIVO'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_row.id IS NOT NULL AND v_row.status = 'RETORNANDO' THEN
    PERFORM public.queue_audit_insert(
      v_row.id, _restaurant_id, _driver_id, 'IDEMPOTENT',
      'RETORNANDO', 'RETORNANDO', v_row.position, v_row.position,
      jsonb_build_object('operation','queue_start_return')
    );
    RETURN true;
  END IF;

  IF v_row.id IS NOT NULL THEN
    UPDATE public.delivery_queue
       SET status = 'RETORNANDO', position = 0, left_at = COALESCE(left_at, now())
     WHERE id = v_row.id;
    PERFORM public.queue_audit_insert(v_row.id, _restaurant_id, _driver_id, 'RETURN_STARTED', v_row.status, 'RETORNANDO', v_row.position, 0);
    IF v_row.status = 'AGUARDANDO' THEN
      PERFORM public.queue_reposition_after(_restaurant_id, v_row.position);
    END IF;
    RETURN true;
  END IF;

  INSERT INTO public.delivery_queue (restaurant_id, driver_id, position, status, entered_at, left_at)
  VALUES (_restaurant_id, _driver_id, 0, 'RETORNANDO', now(), now())
  RETURNING id INTO v_id;
  PERFORM public.queue_audit_insert(v_id, _restaurant_id, _driver_id, 'RETURN_STARTED', NULL, 'RETORNANDO', NULL, 0);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_return(_restaurant_id UUID, _driver_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_id UUID;
  v_pos INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant_id::text));

  SELECT * INTO v_existing
    FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id
     AND driver_id = _driver_id
     AND status <> 'INATIVO'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_existing.id IS NOT NULL AND v_existing.status = 'AGUARDANDO' THEN
    PERFORM public.queue_audit_insert(
      v_existing.id, _restaurant_id, _driver_id, 'IDEMPOTENT',
      'AGUARDANDO', 'AGUARDANDO', v_existing.position, v_existing.position,
      jsonb_build_object('operation','queue_return')
    );
    RETURN v_existing.id;
  END IF;

  PERFORM public.queue_assert_driver_can_wait(_restaurant_id, _driver_id);

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.delivery_queue
       SET status = 'INATIVO', left_at = COALESCE(left_at, now())
     WHERE id = v_existing.id;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1
    INTO v_pos
    FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id
     AND status = 'AGUARDANDO';

  INSERT INTO public.delivery_queue (restaurant_id, driver_id, position, status, entered_at)
  VALUES (_restaurant_id, _driver_id, v_pos, 'AGUARDANDO', now())
  RETURNING id INTO v_id;

  PERFORM public.queue_audit_insert(
    v_id, _restaurant_id, _driver_id, 'RETURN_FINISHED',
    COALESCE(v_existing.status, NULL), 'AGUARDANDO',
    COALESCE(v_existing.position, NULL), v_pos
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_remove(_restaurant_id UUID, _driver_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant_id::text));

  SELECT * INTO v_row
    FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id
     AND driver_id = _driver_id
     AND status <> 'INATIVO'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.delivery_queue
     SET status = 'INATIVO', left_at = COALESCE(left_at, now())
   WHERE id = v_row.id;

  PERFORM public.queue_audit_insert(v_row.id, _restaurant_id, _driver_id, 'LEAVE', v_row.status, 'INATIVO', v_row.position, v_row.position);
  IF v_row.status = 'AGUARDANDO' THEN
    PERFORM public.queue_reposition_after(_restaurant_id, v_row.position);
  END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_audit_insert(UUID, UUID, UUID, TEXT, public.delivery_queue_status, public.delivery_queue_status, INTEGER, INTEGER, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.queue_reposition_after(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_assert_driver_can_wait(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_enqueue(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.queue_dequeue(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_start_return(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_return(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_remove(UUID, UUID) TO authenticated, service_role;
