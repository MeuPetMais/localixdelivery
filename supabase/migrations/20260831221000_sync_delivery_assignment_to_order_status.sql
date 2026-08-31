-- Keep delivery assignment state and canonical order state in sync.
-- Also allow restaurant owners to close an already delivered order as concluido.

DO $$
DECLARE
  v_def text;
  v_old text := '''saiu_para_entrega'', ''entregue'', ''cancelado''';
  v_new text := '''saiu_para_entrega'', ''entregue'', ''concluido'', ''cancelado''';
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'order_apply_transition'
   LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'order_apply_transition not found';
  END IF;

  IF position(v_new in v_def) = 0 THEN
    IF position(v_old in v_def) = 0 THEN
      RAISE EXCEPTION 'restaurant actor transition list signature not found';
    END IF;
    v_def := replace(v_def, v_old, v_new);
    EXECUTE v_def;
  END IF;
END $$;

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
  v_order_status text;
  v_order_result jsonb;
  v_order_next text;
  v_sync_metadata jsonb;
BEGIN
  SELECT status, order_id
    INTO v_current, v_order_id
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

-- One-time reconciliation for deliveries already completed before this migration.
WITH stale AS (
  SELECT DISTINCT ON (o.id)
         o.id AS order_id,
         o.status AS previous_status,
         a.id AS assignment_id,
         a.driver_id,
         a.delivered_at,
         dd.owner_id AS driver_owner_id
    FROM public.orders o
    JOIN public.delivery_assignments a ON a.order_id = o.id
    LEFT JOIN public.delivery_drivers dd ON dd.id = a.driver_id
   WHERE a.status = 'ENTREGUE'
     AND o.status IN ('pronto', 'saiu_para_entrega')
   ORDER BY o.id, a.delivered_at DESC NULLS LAST, a.updated_at DESC
), history AS (
  INSERT INTO public.order_status_history (
    order_id, previous_status, current_status, reason,
    performed_by, performed_by_type, metadata, created_at
  )
  SELECT order_id,
         previous_status,
         'entregue',
         'Reconciliação automática: entrega já concluída pelo entregador',
         driver_owner_id,
         'courier',
         jsonb_build_object(
           'assignment_id', assignment_id,
           'source', 'migration_delivery_order_status_sync',
           'reconciled', true
         ),
         COALESCE(delivered_at, now())
    FROM stale
  RETURNING order_id
)
UPDATE public.orders o
   SET status = 'entregue',
       updated_at = now()
 WHERE o.id IN (SELECT order_id FROM history);
