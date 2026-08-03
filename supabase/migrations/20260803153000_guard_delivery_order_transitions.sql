-- Bloqueia atalhos de status para pedidos delivery sem passar pelo Assignment Domain.
-- Retirada/mesa continuam sem exigir motoboy porque nao possuem endereco de entrega.

CREATE OR REPLACE FUNCTION public.order_apply_transition(
  _order_id uuid,
  _expected_from text,
  _next_status text,
  _reason text,
  _actor_type text,
  _actor_id uuid,
  _metadata jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current text;
  v_address text;
  v_history_id uuid;
  v_assignment_id uuid;
  v_assignment_status text;
BEGIN
  -- Lock da linha para garantir CAS atomico.
  SELECT status, address INTO v_current, v_address
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF v_current IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ORDER_NOT_FOUND');
  END IF;

  IF v_current <> _expected_from THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'STATE_MISMATCH',
      'current', v_current,
      'expected', _expected_from
    );
  END IF;

  IF NULLIF(BTRIM(COALESCE(v_address, '')), '') IS NOT NULL
     AND _next_status IN ('saiu_para_entrega', 'entregue') THEN
    v_assignment_id := NULLIF(_metadata->>'assignment_id', '')::uuid;

    IF v_assignment_id IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'DELIVERY_ASSIGNMENT_REQUIRED',
        'message', 'Este pedido ainda não possui motoboy designado. Faça o despacho na Central de Entregas.'
      );
    END IF;

    SELECT status INTO v_assignment_status
      FROM public.delivery_assignments
     WHERE id = v_assignment_id
       AND order_id = _order_id
     FOR UPDATE;

    IF _next_status = 'saiu_para_entrega'
       AND COALESCE(v_assignment_status, '') <> 'EM_ROTA' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'DELIVERY_ASSIGNMENT_FLOW_REQUIRED',
        'assignment_status', v_assignment_status
      );
    END IF;

    IF _next_status = 'entregue'
       AND COALESCE(v_assignment_status, '') <> 'ENTREGUE' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'DELIVERY_ASSIGNMENT_FLOW_REQUIRED',
        'assignment_status', v_assignment_status
      );
    END IF;
  END IF;

  UPDATE public.orders
     SET status = _next_status,
         updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.order_status_history (
    order_id, previous_status, current_status, reason,
    performed_by, performed_by_type, metadata
  ) VALUES (
    _order_id, v_current, _next_status, _reason,
    _actor_id, _actor_type, COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_history_id;

  RETURN jsonb_build_object(
    'ok', true,
    'previous', v_current,
    'current', _next_status,
    'history_id', v_history_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.order_apply_transition(uuid, text, text, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_apply_transition(uuid, text, text, text, text, uuid, jsonb) TO service_role;
