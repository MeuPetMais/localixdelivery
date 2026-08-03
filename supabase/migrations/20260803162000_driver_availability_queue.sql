-- Coordena presenca online do motoboy com a fila operacional.
-- Mantem a entrada na fila transacional: se queue_enqueue falhar, o update de
-- delivery_drivers.online tambem e revertido pelo PostgreSQL.

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

    IF v_queue.status = 'RETORNANDO' OR v_has_return THEN
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
