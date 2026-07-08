
-- RC4.2: RPC atômica para aplicar transições de status.
-- Responsabilidade MÍNIMA: UPDATE orders.status + INSERT order_status_history
-- em uma única transação, com Compare-And-Swap (CAS) via _expected_from.
-- Nenhuma regra de State Machine, permissões ou eventos aqui — essas responsabilidades
-- vivem no OrderOrchestrator (TypeScript).

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
  v_history_id uuid;
BEGIN
  -- Lock da linha para garantir CAS atômico
  SELECT status INTO v_current
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
