-- ADMIN-ORD-1: harden order status transitions.
-- Scope: keep the existing RPC signature/atomicity, validate the canonical
-- transition matrix in SQL, reject actor spoofing, and remove direct status
-- updates from public API roles.

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
  v_customer_id uuid;
  v_restaurant_id uuid;
  v_history_id uuid;
  v_assignment_id uuid;
  v_assignment_status text;
  v_is_service_role boolean := COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role';
  v_auth_uid uuid := auth.uid();
  v_transition_allowed boolean := false;
  v_actor_allowed boolean := false;
BEGIN
  -- Lock da linha para garantir CAS atomico.
  SELECT status, address, customer_id, restaurant_id
    INTO v_current, v_address, v_customer_id, v_restaurant_id
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

  v_transition_allowed :=
    (v_current = 'novo' AND _next_status IN ('aguardando_pagamento', 'cancelado')) OR
    (v_current = 'aguardando_pagamento' AND _next_status IN ('pago', 'falha_pagamento', 'cancelado')) OR
    (v_current = 'pago' AND _next_status IN ('aceito', 'rejeitado', 'reembolsado', 'chargeback', 'cancelado')) OR
    (v_current = 'falha_pagamento' AND _next_status IN ('aguardando_pagamento', 'cancelado')) OR
    (v_current = 'aceito' AND _next_status IN ('em_preparo', 'cancelado', 'reembolsado')) OR
    (v_current = 'em_preparo' AND _next_status IN ('pronto', 'cancelado')) OR
    (v_current = 'pronto' AND _next_status IN ('saiu_para_entrega', 'entregue', 'cancelado')) OR
    (v_current = 'saiu_para_entrega' AND _next_status IN ('entregue', 'cancelado')) OR
    (v_current = 'entregue' AND _next_status IN ('concluido', 'reembolsado', 'chargeback')) OR
    (v_current = 'concluido' AND _next_status IN ('reembolsado', 'chargeback'));

  IF NOT v_transition_allowed THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'INVALID_TRANSITION',
      'current', v_current,
      'requested', _next_status
    );
  END IF;

  v_actor_allowed :=
    (_actor_type = 'customer' AND _next_status IN ('novo', 'cancelado')) OR
    (_actor_type = 'restaurant' AND _next_status IN (
      'aceito', 'rejeitado', 'em_preparo', 'pronto',
      'saiu_para_entrega', 'entregue', 'cancelado'
    )) OR
    (_actor_type = 'admin' AND _next_status IN (
      'pago', 'falha_pagamento', 'aceito', 'rejeitado', 'em_preparo',
      'pronto', 'saiu_para_entrega', 'entregue', 'concluido',
      'cancelado', 'reembolsado', 'chargeback'
    )) OR
    (_actor_type = 'system' AND _next_status IN (
      'novo', 'aguardando_pagamento', 'pago', 'falha_pagamento',
      'concluido', 'cancelado', 'reembolsado', 'chargeback'
    )) OR
    (_actor_type = 'webhook' AND _next_status IN (
      'pago', 'falha_pagamento', 'reembolsado', 'chargeback'
    )) OR
    (_actor_type = 'courier' AND _next_status IN ('saiu_para_entrega', 'entregue'));

  IF NOT v_actor_allowed THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'FORBIDDEN_ACTOR',
      'current', v_current,
      'requested', _next_status,
      'actor_type', _actor_type
    );
  END IF;

  IF NOT v_is_service_role THEN
    IF v_auth_uid IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'ACTOR_NOT_AUTHORIZED',
        'actor_type', _actor_type
      );
    END IF;

    IF _actor_type IN ('system', 'webhook') THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'ACTOR_NOT_AUTHORIZED',
        'actor_type', _actor_type
      );
    END IF;

    IF _actor_type = 'admin' AND NOT public.has_role(v_auth_uid, 'admin'::public.app_role) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'ACTOR_NOT_AUTHORIZED',
        'actor_type', _actor_type
      );
    END IF;

    IF _actor_type = 'restaurant'
       AND NOT EXISTS (
         SELECT 1
           FROM public.restaurants r
          WHERE r.id = v_restaurant_id
            AND r.owner_id = v_auth_uid
       ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'ACTOR_NOT_AUTHORIZED',
        'actor_type', _actor_type
      );
    END IF;

    IF _actor_type = 'customer' AND v_customer_id IS DISTINCT FROM v_auth_uid THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'ACTOR_NOT_AUTHORIZED',
        'actor_type', _actor_type
      );
    END IF;

    IF _actor_type = 'courier'
       AND NOT EXISTS (
         SELECT 1
           FROM public.delivery_assignments da
           JOIN public.delivery_drivers dd ON dd.id = da.driver_id
          WHERE da.order_id = _order_id
            AND da.id = NULLIF(COALESCE(_metadata, '{}'::jsonb)->>'assignment_id', '')::uuid
            AND dd.owner_id = v_auth_uid
       ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'ACTOR_NOT_AUTHORIZED',
        'actor_type', _actor_type
      );
    END IF;
  END IF;

  IF NULLIF(BTRIM(COALESCE(v_address, '')), '') IS NOT NULL
     AND _next_status IN ('saiu_para_entrega', 'entregue') THEN
    v_assignment_id := NULLIF(COALESCE(_metadata, '{}'::jsonb)->>'assignment_id', '')::uuid;

    IF v_assignment_id IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'DELIVERY_ASSIGNMENT_REQUIRED',
        'message', 'Este pedido ainda nao possui motoboy designado. Faca o despacho na Central de Entregas.'
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

REVOKE UPDATE ON public.orders FROM anon, authenticated;
REVOKE UPDATE (
  id,
  restaurant_id,
  customer_id,
  customer_name,
  customer_phone,
  address,
  payment_method,
  items,
  total,
  status,
  discount,
  coupon_id,
  loyalty_discount,
  loyalty_points_reserved,
  loyalty_points_consumed,
  platform_fee,
  fixed_fee,
  commission_rate,
  order_number,
  estimated_delivery_time,
  created_at,
  updated_at
) ON public.orders FROM anon, authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT EXECUTE ON FUNCTION public.order_apply_transition(uuid, text, text, text, text, uuid, jsonb)
  TO anon, authenticated, service_role;
