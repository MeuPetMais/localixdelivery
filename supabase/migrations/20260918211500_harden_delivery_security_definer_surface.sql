-- Gate D hardening: reduce SECURITY DEFINER delivery RPC surface.
--
-- Root cause:
-- Supabase default EXECUTE privileges granted anon/authenticated direct access
-- to SECURITY DEFINER functions even where the original migrations intended
-- service_role-only execution.
--
-- This migration:
-- 1) removes direct anon/authenticated access from internal delivery mutation RPCs;
-- 2) keeps the explicitly authenticated driver-context/location RPCs authenticated;
-- 3) hardens delivery_assignment_apply_transition itself with actor/ownership checks
--    and the canonical assignment state machine.

CREATE OR REPLACE FUNCTION public.delivery_assignment_apply_transition(
  _assignment_id uuid,
  _expected_from text,
  _next_status text,
  _actor text,
  _actor_id uuid,
  _reason text,
  _correlation_id uuid,
  _metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current text;
  v_now timestamptz := now();
  v_history_id uuid;
  v_order_id uuid;
  v_restaurant_id uuid;
  v_driver_id uuid;
  v_order_status text;
  v_order_result jsonb;
  v_order_next text;
  v_sync_metadata jsonb;
  v_auth_uid uuid := auth.uid();
  v_is_service_role boolean := auth.role() = 'service_role';
  v_transition_allowed boolean := false;
  v_actor_allowed boolean := false;
BEGIN
  SELECT status, order_id, restaurant_id, driver_id
    INTO v_current, v_order_id, v_restaurant_id, v_driver_id
    FROM public.delivery_assignments
   WHERE id = _assignment_id
   FOR UPDATE;

  IF v_current IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ASSIGNMENT_NOT_FOUND');
  END IF;

  IF v_current <> _expected_from THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'STATE_MISMATCH',
      'current', v_current,
      'expected', _expected_from
    );
  END IF;

  v_transition_allowed :=
    (v_current = 'PENDENTE' AND _next_status IN ('ATRIBUIDO', 'CANCELADO')) OR
    (v_current = 'ATRIBUIDO' AND _next_status IN ('COLETANDO', 'CANCELADO')) OR
    (v_current = 'COLETANDO' AND _next_status IN ('EM_ROTA', 'CANCELADO')) OR
    (v_current = 'EM_ROTA' AND _next_status IN ('ENTREGUE', 'CANCELADO'));

  IF NOT v_transition_allowed THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'INVALID_TRANSITION',
      'current', v_current,
      'requested', _next_status
    );
  END IF;

  IF NOT v_is_service_role THEN
    IF v_auth_uid IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'ACTOR_NOT_AUTHORIZED');
    END IF;

    IF _actor_id IS DISTINCT FROM v_auth_uid THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'ACTOR_NOT_AUTHORIZED',
        'actor', _actor
      );
    END IF;

    v_actor_allowed :=
      (_actor = 'admin' AND public.has_role(v_auth_uid, 'admin'::public.app_role))
      OR
      (_actor = 'restaurant' AND EXISTS (
        SELECT 1
          FROM public.restaurants r
         WHERE r.id = v_restaurant_id
           AND r.owner_id = v_auth_uid
      ))
      OR
      (_actor IN ('driver', 'courier') AND EXISTS (
        SELECT 1
          FROM public.delivery_drivers d
         WHERE d.id = v_driver_id
           AND d.owner_id = v_auth_uid
      ));

    IF NOT v_actor_allowed THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'ACTOR_NOT_AUTHORIZED',
        'actor', _actor
      );
    END IF;
  END IF;

  UPDATE public.delivery_assignments
     SET status = _next_status,
         assigned_at  = CASE WHEN _next_status = 'ATRIBUIDO' AND assigned_at IS NULL THEN v_now ELSE assigned_at END,
         picked_up_at = CASE WHEN _next_status = 'COLETANDO' AND picked_up_at IS NULL THEN v_now ELSE picked_up_at END,
         departed_at  = CASE WHEN _next_status = 'EM_ROTA' AND departed_at IS NULL THEN v_now ELSE departed_at END,
         delivered_at = CASE WHEN _next_status = 'ENTREGUE' AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
         updated_at = v_now
   WHERE id = _assignment_id;

  INSERT INTO public.delivery_assignment_timeline (
    assignment_id, previous_state, current_state, actor, actor_id, reason, correlation_id, metadata
  ) VALUES (
    _assignment_id, v_current, _next_status, _actor, _actor_id, _reason, _correlation_id, COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_history_id;

  IF _next_status IN ('EM_ROTA', 'ENTREGUE') THEN
    SELECT status
      INTO v_order_status
      FROM public.orders
     WHERE id = v_order_id
     FOR UPDATE;

    IF v_order_status IS NULL THEN
      RAISE EXCEPTION 'ORDER_NOT_FOUND_FOR_ASSIGNMENT:%', _assignment_id;
    END IF;

    IF _next_status = 'EM_ROTA' AND v_order_status = 'pronto' THEN
      v_order_next := 'saiu_para_entrega';
    ELSIF _next_status = 'ENTREGUE' AND v_order_status IN ('pronto', 'saiu_para_entrega') THEN
      v_order_next := 'entregue';
    ELSE
      v_order_next := NULL;
    END IF;

    IF v_order_next IS NOT NULL THEN
      v_sync_metadata := COALESCE(_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'assignment_id', _assignment_id,
          'source', 'delivery_assignment_apply_transition',
          'delivery_state', _next_status,
          'correlation_id', _correlation_id
        );

      v_order_result := public.order_apply_transition(
        v_order_id,
        v_order_status,
        v_order_next,
        CASE WHEN v_order_next = 'entregue' THEN 'Entrega concluída' ELSE 'Entrega em rota' END,
        'courier',
        _actor_id,
        v_sync_metadata
      );

      IF NOT COALESCE((v_order_result->>'ok')::boolean, false) THEN
        RAISE EXCEPTION 'ORDER_SYNC_REJECTED:%', COALESCE(v_order_result->>'reason', 'UNKNOWN');
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'previous', v_current,
    'current', _next_status,
    'history_id', v_history_id,
    'order_sync', COALESCE(v_order_next, 'none')
  );
END;
$function$;

-- Authenticated, actor-validated RPC.
REVOKE ALL ON FUNCTION public.delivery_assignment_apply_transition(
  uuid, text, text, text, uuid, text, uuid, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_assignment_apply_transition(
  uuid, text, text, text, uuid, text, uuid, jsonb
) TO authenticated, service_role;

-- Internal delivery mutations: server functions already call these through
-- supabaseAdmin/service_role after validating the authenticated user.
REVOKE ALL ON FUNCTION public.delivery_auto_assign_order(uuid, text, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_auto_assign_order(uuid, text, uuid, uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.delivery_auto_assign_pending_for_restaurant(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_auto_assign_pending_for_restaurant(uuid, text, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.driver_set_availability(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_set_availability(uuid, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.queue_audit_insert(
  uuid, uuid, uuid, text, public.delivery_queue_status, public.delivery_queue_status,
  integer, integer, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_audit_insert(
  uuid, uuid, uuid, text, public.delivery_queue_status, public.delivery_queue_status,
  integer, integer, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.queue_reposition_after(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_reposition_after(uuid, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.queue_assert_driver_can_wait(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_assert_driver_can_wait(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.queue_enqueue(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_enqueue(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.queue_dequeue(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_dequeue(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.queue_start_return(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_start_return(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.queue_return(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_return(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.queue_remove(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_remove(uuid, uuid)
  TO service_role;

-- RPCs that are intentionally callable with an authenticated user JWT.
REVOKE ALL ON FUNCTION public.driver_switch_restaurant_context(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_switch_restaurant_context(uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.upsert_driver_operational_location(
  uuid, uuid, uuid, double precision, double precision, double precision,
  double precision, double precision, timestamptz, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_driver_operational_location(
  uuid, uuid, uuid, double precision, double precision, double precision,
  double precision, double precision, timestamptz, uuid
) TO authenticated, service_role;
