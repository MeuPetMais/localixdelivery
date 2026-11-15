-- Gate 4 isolated Supabase homologation ONLY (gvozcqyjhogmvebrwzap).
-- NEVER execute against Staging or Production. This is a controlled schema fixture,
-- faithfully reconstructed from the Staging table contracts and transition RPC.
-- Intended as the version-controlled evidence for the isolated database migration.
CREATE TYPE public.delivery_driver_status AS ENUM ('ativo','inativo','afastado','aguardando_ativacao');
CREATE TYPE public.delivery_driver_vehicle AS ENUM ('moto','bicicleta','carro','a_pe');
CREATE TABLE public.delivery_drivers (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "restaurant_id" uuid NOT NULL,
 "owner_id" uuid,
 "name" text NOT NULL,
 "phone" text,
 "email" text,
 "cpf" text,
 "photo_url" text,
 "vehicle_type" public.delivery_driver_vehicle DEFAULT 'moto'::delivery_driver_vehicle NOT NULL,
 "vehicle_plate" text,
 "document_url" text,
 "status" public.delivery_driver_status DEFAULT 'ativo'::delivery_driver_status NOT NULL,
 "online" boolean DEFAULT false NOT NULL,
 "last_lat" double precision,
 "last_lng" double precision,
 "last_seen_at" timestamptz,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 "vehicle_model" text,
 "cnh_url" text,
 "address_proof_url" text,
 "last_accuracy" double precision,
 "last_heading" double precision,
 "last_speed" double precision,
 "last_location_device_at" timestamptz,
 "last_location_server_at" timestamptz,
 "location_confidence" text DEFAULT 'MEDIUM'::text NOT NULL
);
ALTER TABLE public.delivery_drivers ADD CONSTRAINT "delivery_drivers_location_confidence_check" CHECK ((location_confidence = ANY (ARRAY['HIGH'::text, 'MEDIUM'::text, 'LOW'::text])));
ALTER TABLE public.delivery_drivers ADD CONSTRAINT "delivery_drivers_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_drivers ADD CONSTRAINT "delivery_drivers_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.delivery_drivers ADD CONSTRAINT "delivery_drivers_pkey" PRIMARY KEY (id);
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.delivery_drivers FROM PUBLIC, anon, authenticated;
CREATE TABLE public.delivery_assignments (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "order_id" uuid NOT NULL,
 "restaurant_id" uuid NOT NULL,
 "driver_id" uuid NOT NULL,
 "status" text DEFAULT 'PENDENTE'::text NOT NULL,
 "assigned_by" uuid,
 "assigned_at" timestamptz,
 "picked_up_at" timestamptz,
 "departed_at" timestamptz,
 "delivered_at" timestamptz,
 "estimated_minutes" integer,
 "distance_km" numeric,
 "correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 "driver_base_fee" numeric,
 "driver_per_km_fee" numeric,
 "driver_distance_km" numeric,
 "driver_earning_amount" numeric,
 "driver_earning_calculated_at" timestamptz
);
ALTER TABLE public.delivery_assignments ADD CONSTRAINT "delivery_assignments_status_check" CHECK ((status = ANY (ARRAY['PENDENTE'::text, 'ATRIBUIDO'::text, 'COLETANDO'::text, 'EM_ROTA'::text, 'ENTREGUE'::text, 'CANCELADO'::text])));
ALTER TABLE public.delivery_assignments ADD CONSTRAINT "delivery_assignments_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES delivery_drivers(id) ON DELETE RESTRICT;
ALTER TABLE public.delivery_assignments ADD CONSTRAINT "delivery_assignments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.delivery_assignments ADD CONSTRAINT "delivery_assignments_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.delivery_assignments ADD CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY (id);
ALTER TABLE public.delivery_assignments ADD CONSTRAINT "delivery_assignments_order_unique" UNIQUE (order_id);
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.delivery_assignments FROM PUBLIC, anon, authenticated;
CREATE TABLE public.order_status_history (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "order_id" uuid NOT NULL,
 "previous_status" text,
 "current_status" text NOT NULL,
 "reason" text,
 "performed_by" text,
 "performed_by_type" text DEFAULT 'system'::text NOT NULL,
 "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.order_status_history ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.order_status_history ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY (id);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_status_history FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.order_apply_transition(_order_id uuid, _expected_from text, _next_status text, _reason text, _actor_type text, _actor_id uuid, _metadata jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current text;
  v_address text;
  v_customer_id uuid;
  v_restaurant_id uuid;
  v_history_id uuid;
  v_assignment_id uuid;
  v_assignment_status text;
  v_is_service_role boolean := auth.role() = 'service_role';
  v_auth_uid uuid := auth.uid();
  v_is_internal_expire_cron boolean := false;
  v_transition_allowed boolean := false;
  v_actor_allowed boolean := false;
  v_has_approved_mercado_pago_payment boolean := false;
BEGIN
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
    (v_current = 'falha_pagamento' AND _next_status IN ('aguardando_pagamento', 'pago', 'cancelado')) OR
    (v_current = 'aceito' AND _next_status IN ('em_preparo', 'cancelado', 'reembolsado')) OR
    (v_current = 'em_preparo' AND _next_status IN ('pronto', 'cancelado')) OR
    (v_current = 'pronto' AND _next_status IN ('saiu_para_entrega', 'entregue', 'concluido', 'cancelado')) OR
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
      'saiu_para_entrega', 'entregue', 'concluido', 'cancelado'
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

  v_is_internal_expire_cron :=
    session_user = 'postgres'
    AND COALESCE(current_setting('request.jwt.claim.role', true), '') = ''
    AND COALESCE(current_setting('request.jwt.claim.sub', true), '') = ''
    AND v_auth_uid IS NULL
    AND _actor_type = 'system'
    AND _expected_from = 'aguardando_pagamento'
    AND v_current = 'aguardando_pagamento'
    AND _next_status = 'falha_pagamento'
    AND _reason = 'auto_expire:15min';

  IF v_current = 'falha_pagamento' AND _next_status = 'pago' THEN
    IF _actor_type NOT IN ('webhook', 'system') THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'FORBIDDEN_ACTOR',
        'current', v_current,
        'requested', _next_status,
        'actor_type', _actor_type
      );
    END IF;

    SELECT EXISTS (
      SELECT 1
        FROM public.order_payment op
       WHERE op.order_id = _order_id
         AND op.provider = 'mercado_pago'
         AND op.status = 'APPROVED'
         AND op.payment_method IN ('pix', 'credit_card')
         AND NULLIF(BTRIM(COALESCE(op.payment_id, '')), '') IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
        FROM public.payments p
       WHERE p.order_id = _order_id
         AND p.provider = 'mercado_pago'
         AND p.status = 'approved'
         AND p.method IN ('pix', 'card', 'credit_card')
         AND NULLIF(BTRIM(COALESCE(p.external_id, '')), '') IS NOT NULL
    )
    INTO v_has_approved_mercado_pago_payment;

    IF NOT v_has_approved_mercado_pago_payment THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'PAYMENT_APPROVAL_REQUIRED',
        'current', v_current,
        'requested', _next_status
      );
    END IF;
  END IF;

  IF NOT v_is_service_role AND NOT v_is_internal_expire_cron THEN
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

  IF _next_status = 'cancelado'
     AND EXISTS (
       SELECT 1
         FROM public.order_payment op
        WHERE op.order_id = _order_id
          AND op.provider = 'mercado_pago'
          AND op.status = 'APPROVED'
          AND op.payment_method IN ('pix', 'credit_card')
          AND NULLIF(BTRIM(COALESCE(op.payment_id, '')), '') IS NOT NULL
     ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'ONLINE_PAYMENT_REFUND_REQUIRED',
      'current', v_current,
      'requested', _next_status
    );
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

  UPDATE public.order_pricing_snapshot
     SET realized_platform_revenue = CASE
       WHEN _next_status IN ('entregue', 'concluido') THEN platform_revenue
       WHEN _next_status IN ('reembolsado', 'chargeback') THEN 0
       ELSE realized_platform_revenue
     END
   WHERE order_id = _order_id
     AND _next_status IN ('entregue', 'concluido', 'reembolsado', 'chargeback');

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
$function$
;
REVOKE ALL ON FUNCTION public.order_apply_transition(uuid,text,text,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_apply_transition(uuid,text,text,text,text,uuid,jsonb) TO service_role;
