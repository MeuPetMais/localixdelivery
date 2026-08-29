-- Corrige queue_enqueue apos a autoatribuicao:
-- 1. usa a assinatura real de queue_audit_insert com 9 parametros;
-- 2. nao trata linhas EM_ENTREGA/RETORNANDO stale como entrada ativa na fila;
-- 3. preserva bloqueios para entrega, retorno e pausa realmente ativos.

CREATE OR REPLACE FUNCTION public.queue_enqueue(_restaurant_id UUID, _driver_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_new_id UUID;
  v_pos INTEGER;
  v_corr UUID := gen_random_uuid();
  v_has_active_assignment BOOLEAN;
  v_has_active_return BOOLEAN;
  v_has_pause BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant_id::text));

  SELECT *
    INTO v_existing
    FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id
     AND driver_id = _driver_id
     AND status <> 'INATIVO'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  SELECT EXISTS (
    SELECT 1
      FROM public.delivery_assignments a
     WHERE a.restaurant_id = _restaurant_id
       AND a.driver_id = _driver_id
       AND a.status IN ('ATRIBUIDO', 'COLETANDO', 'EM_ROTA')
  ) INTO v_has_active_assignment;

  SELECT EXISTS (
    SELECT 1
      FROM public.driver_shifts s
     WHERE s.restaurant_id = _restaurant_id
       AND s.driver_id = _driver_id
       AND s.status <> 'FINALIZADO'
       AND s.current_state = 'RETORNANDO'
  ) INTO v_has_active_return;

  SELECT EXISTS (
    SELECT 1
      FROM public.driver_shifts s
     WHERE s.restaurant_id = _restaurant_id
       AND s.driver_id = _driver_id
       AND s.status <> 'FINALIZADO'
       AND (s.status = 'PAUSADO' OR s.current_state = 'PAUSA')
  ) INTO v_has_pause;

  IF v_has_active_assignment THEN
    RAISE EXCEPTION 'DRIVER_HAS_ACTIVE_ASSIGNMENT';
  END IF;

  IF v_has_active_return THEN
    RAISE EXCEPTION 'DRIVER_RETURNING';
  END IF;

  IF v_has_pause THEN
    RAISE EXCEPTION 'DRIVER_UNAVAILABLE';
  END IF;

  IF v_existing.id IS NOT NULL AND v_existing.status = 'AGUARDANDO' THEN
    PERFORM public.queue_audit_insert(
      v_existing.id::UUID,
      _restaurant_id::UUID,
      _driver_id::UUID,
      'IDEMPOTENT'::TEXT,
      v_existing.status::public.delivery_queue_status,
      v_existing.status::public.delivery_queue_status,
      v_existing.position::INTEGER,
      v_existing.position::INTEGER,
      jsonb_build_object('operation', 'queue_enqueue', 'correlation_id', v_corr)::JSONB
    );
    PERFORM public.delivery_auto_assign_pending_for_restaurant(_restaurant_id, 'QUEUE_AVAILABLE', v_corr);
    RETURN v_existing.id;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.delivery_queue
       SET status = 'INATIVO',
           position = 0,
           left_at = COALESCE(left_at, now())
     WHERE id = v_existing.id;

    PERFORM public.queue_audit_insert(
      v_existing.id::UUID,
      _restaurant_id::UUID,
      _driver_id::UUID,
      'RECOVER_STALE'::TEXT,
      v_existing.status::public.delivery_queue_status,
      'INATIVO'::public.delivery_queue_status,
      v_existing.position::INTEGER,
      0::INTEGER,
      jsonb_build_object('operation', 'queue_enqueue', 'correlation_id', v_corr)::JSONB
    );

    IF v_existing.status = 'AGUARDANDO' THEN
      PERFORM public.queue_reposition_after(_restaurant_id, v_existing.position);
    END IF;
  END IF;

  PERFORM public.queue_assert_driver_can_wait(_restaurant_id, _driver_id);

  SELECT COALESCE(MAX(position), 0) + 1
    INTO v_pos
    FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id
     AND status = 'AGUARDANDO';

  INSERT INTO public.delivery_queue (restaurant_id, driver_id, position, status, entered_at)
  VALUES (_restaurant_id, _driver_id, v_pos, 'AGUARDANDO', now())
  RETURNING id INTO v_new_id;

  PERFORM public.queue_audit_insert(
    v_new_id::UUID,
    _restaurant_id::UUID,
    _driver_id::UUID,
    'ENTER'::TEXT,
    NULL::public.delivery_queue_status,
    'AGUARDANDO'::public.delivery_queue_status,
    NULL::INTEGER,
    v_pos::INTEGER,
    jsonb_build_object('operation', 'queue_enqueue', 'correlation_id', v_corr)::JSONB
  );

  PERFORM public.delivery_auto_assign_pending_for_restaurant(_restaurant_id, 'QUEUE_AVAILABLE', v_corr);

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_enqueue(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.driver_set_availability(_owner_id UUID, _online BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver RECORD;
  v_queue RECORD;
  v_queue_id UUID;
  v_has_active_assignment BOOLEAN;
  v_has_return BOOLEAN;
  v_has_pause BOOLEAN;
BEGIN
  SELECT id, restaurant_id, status, online
    INTO v_driver
    FROM public.delivery_drivers
   WHERE owner_id = _owner_id
   FOR UPDATE;

  IF v_driver.id IS NULL THEN
    RAISE EXCEPTION 'Motoboy nao encontrado';
  END IF;

  IF v_driver.status <> 'ativo' THEN
    RAISE EXCEPTION 'Cadastro nao esta ativo';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_driver.restaurant_id::text));

  SELECT *
    INTO v_queue
    FROM public.delivery_queue
   WHERE restaurant_id = v_driver.restaurant_id
     AND driver_id = v_driver.id
     AND status <> 'INATIVO'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  SELECT EXISTS (
    SELECT 1
      FROM public.delivery_assignments a
     WHERE a.driver_id = v_driver.id
       AND a.status IN ('ATRIBUIDO', 'COLETANDO', 'EM_ROTA')
  ) INTO v_has_active_assignment;

  SELECT EXISTS (
    SELECT 1
      FROM public.driver_shifts s
     WHERE s.driver_id = v_driver.id
       AND s.status <> 'FINALIZADO'
       AND s.current_state = 'RETORNANDO'
  ) INTO v_has_return;

  SELECT EXISTS (
    SELECT 1
      FROM public.driver_shifts s
     WHERE s.driver_id = v_driver.id
       AND s.status <> 'FINALIZADO'
       AND (s.status = 'PAUSADO' OR s.current_state = 'PAUSA')
  ) INTO v_has_pause;

  IF _online THEN
    UPDATE public.delivery_drivers
       SET online = true, last_seen_at = now()
     WHERE id = v_driver.id;

    IF v_has_active_assignment THEN
      INSERT INTO public.delivery_driver_audit (
        actor_id, restaurant_id, driver_id, action, before, after
      ) VALUES (
        _owner_id, v_driver.restaurant_id, v_driver.id, 'PRESENCE',
        jsonb_build_object('online', v_driver.online),
        jsonb_build_object('online', true, 'queue_action', 'ACTIVE_ASSIGNMENT')
      );

      RETURN jsonb_build_object(
        'ok', true,
        'online', true,
        'in_queue', false,
        'state', 'em_entrega'
      );
    END IF;

    IF v_has_return THEN
      INSERT INTO public.delivery_driver_audit (
        actor_id, restaurant_id, driver_id, action, before, after
      ) VALUES (
        _owner_id, v_driver.restaurant_id, v_driver.id, 'PRESENCE',
        jsonb_build_object('online', v_driver.online),
        jsonb_build_object('online', true, 'queue_action', 'RETURNING')
      );

      RETURN jsonb_build_object(
        'ok', true,
        'online', true,
        'in_queue', false,
        'state', 'retornando'
      );
    END IF;

    IF v_has_pause THEN
      INSERT INTO public.delivery_driver_audit (
        actor_id, restaurant_id, driver_id, action, before, after
      ) VALUES (
        _owner_id, v_driver.restaurant_id, v_driver.id, 'PRESENCE',
        jsonb_build_object('online', v_driver.online),
        jsonb_build_object('online', true, 'queue_action', 'PAUSED')
      );

      RETURN jsonb_build_object(
        'ok', true,
        'online', true,
        'in_queue', false,
        'state', 'pausa'
      );
    END IF;

    v_queue_id := public.queue_enqueue(v_driver.restaurant_id, v_driver.id);

    SELECT *
      INTO v_queue
      FROM public.delivery_queue
     WHERE id = v_queue_id;

    INSERT INTO public.delivery_driver_audit (
      actor_id, restaurant_id, driver_id, action, before, after
    ) VALUES (
      _owner_id, v_driver.restaurant_id, v_driver.id, 'PRESENCE',
      jsonb_build_object('online', v_driver.online),
      jsonb_build_object(
        'online', true,
        'queue_action', 'ENQUEUE',
        'queue_id', v_queue_id,
        'queue_position', v_queue.position
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'online', true,
      'in_queue', v_queue.status = 'AGUARDANDO',
      'queue_id', v_queue.id,
      'queue_status', v_queue.status,
      'position', v_queue.position,
      'entered_at', v_queue.entered_at,
      'state', CASE WHEN v_queue.status = 'AGUARDANDO' THEN 'na_fila' ELSE lower(v_queue.status::text) END
    );
  END IF;

  IF v_has_active_assignment THEN
    RAISE EXCEPTION 'Finalize ou redistribua a entrega antes de ficar offline.';
  END IF;

  IF v_queue.status = 'RETORNANDO' OR v_has_return THEN
    RAISE EXCEPTION 'Finalize o retorno antes de ficar offline.';
  END IF;

  IF v_has_pause THEN
    RAISE EXCEPTION 'Finalize a pausa antes de ficar offline.';
  END IF;

  PERFORM public.queue_remove(v_driver.restaurant_id, v_driver.id);

  UPDATE public.delivery_drivers
     SET online = false, last_seen_at = now()
   WHERE id = v_driver.id;

  INSERT INTO public.delivery_driver_audit (
    actor_id, restaurant_id, driver_id, action, before, after
  ) VALUES (
    _owner_id, v_driver.restaurant_id, v_driver.id, 'PRESENCE',
    jsonb_build_object('online', v_driver.online),
    jsonb_build_object('online', false, 'queue_action', 'REMOVE')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'online', false,
    'in_queue', false,
    'state', 'offline'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.driver_set_availability(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_set_availability(UUID, BOOLEAN) TO service_role;
