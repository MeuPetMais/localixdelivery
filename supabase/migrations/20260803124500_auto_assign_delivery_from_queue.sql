-- Automatic delivery assignment from the restaurant FIFO queue.
-- Triggered when an order becomes ready and retried when a driver joins the queue.

CREATE TABLE IF NOT EXISTS public.delivery_auto_assignment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES public.delivery_assignments(id) ON DELETE SET NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  previous_queue_position INTEGER,
  reason TEXT NOT NULL,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_auto_assignment_audit_order_idx
  ON public.delivery_auto_assignment_audit(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_auto_assignment_audit_restaurant_idx
  ON public.delivery_auto_assignment_audit(restaurant_id, created_at DESC);

GRANT SELECT ON public.delivery_auto_assignment_audit TO authenticated;
GRANT ALL ON public.delivery_auto_assignment_audit TO service_role;

ALTER TABLE public.delivery_auto_assignment_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own auto assignment audit" ON public.delivery_auto_assignment_audit;
CREATE POLICY "Owners read own auto assignment audit"
  ON public.delivery_auto_assignment_audit FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = delivery_auto_assignment_audit.restaurant_id
      AND r.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Drivers read own auto assignment audit" ON public.delivery_auto_assignment_audit;
CREATE POLICY "Drivers read own auto assignment audit"
  ON public.delivery_auto_assignment_audit FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_drivers d
    WHERE d.id = delivery_auto_assignment_audit.driver_id
      AND d.owner_id = auth.uid()
  ));

CREATE UNIQUE INDEX IF NOT EXISTS delivery_assignments_active_driver_uniq
  ON public.delivery_assignments(driver_id)
  WHERE status IN ('ATRIBUIDO','COLETANDO','EM_ROTA');

INSERT INTO public.notification_templates (code, name, channel, language, subject, title, body, variables_json)
VALUES (
  'DELIVERY_ASSIGNED',
  'Entrega atribuida',
  'IN_APP',
  'pt-BR',
  NULL,
  'Nova entrega atribuida',
  'Pedido #{{order_number}}. Retirada: {{pickup_address}}. Entrega: {{delivery_address}}.',
  '["order_number","pickup_address","delivery_address","delivery_value"]'
)
ON CONFLICT (code, channel, language) DO NOTHING;

CREATE OR REPLACE FUNCTION public.delivery_auto_assign_order(
  _order_id UUID,
  _reason TEXT DEFAULT 'ORDER_READY',
  _correlation_id UUID DEFAULT gen_random_uuid(),
  _forced_driver_id UUID DEFAULT NULL,
  _actor_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_existing RECORD;
  v_queue RECORD;
  v_assignment_id UUID;
  v_driver_owner UUID;
  v_restaurant RECORD;
BEGIN
  SELECT id, restaurant_id, status, order_number, address, total
    INTO v_order
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ORDER_NOT_FOUND');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_order.restaurant_id::text));
  PERFORM pg_advisory_xact_lock(hashtext(v_order.id::text));

  IF v_order.status <> 'pronto' THEN
    INSERT INTO public.delivery_auto_assignment_audit (
      order_id, restaurant_id, reason, correlation_id, metadata
    ) VALUES (
      v_order.id, v_order.restaurant_id, 'ORDER_NOT_ELIGIBLE', _correlation_id,
      jsonb_build_object('order_status', v_order.status, 'source', _reason)
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'ORDER_NOT_ELIGIBLE', 'order_status', v_order.status);
  END IF;

  SELECT *
    INTO v_existing
    FROM public.delivery_assignments
   WHERE order_id = v_order.id
   FOR UPDATE;

  IF v_existing.id IS NOT NULL AND v_existing.status IN ('ATRIBUIDO','COLETANDO','EM_ROTA') AND _forced_driver_id IS NULL THEN
    INSERT INTO public.delivery_auto_assignment_audit (
      order_id, assignment_id, restaurant_id, driver_id, reason, correlation_id, metadata
    ) VALUES (
      v_order.id, v_existing.id, v_order.restaurant_id, v_existing.driver_id,
      'ALREADY_ASSIGNED', COALESCE(v_existing.correlation_id, _correlation_id),
      jsonb_build_object('idempotent', true, 'source', _reason)
    );
    RETURN jsonb_build_object(
      'ok', true,
      'reason', 'ALREADY_ASSIGNED',
      'assignment_id', v_existing.id,
      'driver_id', v_existing.driver_id,
      'idempotent', true
    );
  END IF;

  SELECT q.id AS queue_id, q.driver_id, q.position, d.owner_id AS driver_owner
    INTO v_queue
    FROM public.delivery_queue q
    JOIN public.delivery_drivers d ON d.id = q.driver_id
   WHERE q.restaurant_id = v_order.restaurant_id
     AND q.status = 'AGUARDANDO'
     AND (_forced_driver_id IS NULL OR q.driver_id = _forced_driver_id)
     AND d.restaurant_id = v_order.restaurant_id
     AND d.status = 'ativo'
     AND d.online = true
     AND NOT EXISTS (
       SELECT 1 FROM public.driver_shifts s
        WHERE s.driver_id = d.id
          AND s.restaurant_id = v_order.restaurant_id
          AND s.status <> 'FINALIZADO'
          AND s.current_state IN ('PAUSADO','PAUSA','EM_ENTREGA','RETORNANDO')
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_assignments a
        WHERE a.driver_id = d.id
          AND a.status IN ('ATRIBUIDO','COLETANDO','EM_ROTA')
     )
   ORDER BY q.position ASC, q.entered_at ASC
   LIMIT 1
   FOR UPDATE OF q SKIP LOCKED;

  IF v_queue.driver_id IS NULL THEN
    INSERT INTO public.delivery_auto_assignment_audit (
      order_id, restaurant_id, reason, correlation_id, metadata
    ) VALUES (
      v_order.id, v_order.restaurant_id, 'NO_DRIVER_AVAILABLE', _correlation_id,
      jsonb_build_object('source', _reason, 'forced_driver_id', _forced_driver_id)
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_DRIVER_AVAILABLE');
  END IF;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.delivery_assignments (
      order_id, restaurant_id, driver_id, status, assigned_by, assigned_at,
      correlation_id, metadata
    ) VALUES (
      v_order.id, v_order.restaurant_id, v_queue.driver_id, 'ATRIBUIDO',
      _actor_id, now(), _correlation_id,
      jsonb_build_object(
        'automatic', _forced_driver_id IS NULL,
        'source', _reason,
        'previous_queue_position', v_queue.position
      )
    )
    RETURNING id INTO v_assignment_id;

    INSERT INTO public.delivery_assignment_timeline (
      assignment_id, previous_state, current_state, actor, actor_id, reason, correlation_id, metadata
    ) VALUES (
      v_assignment_id, 'PENDENTE', 'ATRIBUIDO', COALESCE(CASE WHEN _actor_id IS NULL THEN 'system' ELSE 'restaurant' END, 'system'),
      _actor_id, _reason, _correlation_id,
      jsonb_build_object('previous_queue_position', v_queue.position, 'automatic', _forced_driver_id IS NULL)
    );
  ELSE
    UPDATE public.delivery_assignments
       SET driver_id = v_queue.driver_id,
           status = 'ATRIBUIDO',
           assigned_by = _actor_id,
           assigned_at = now(),
           picked_up_at = NULL,
           departed_at = NULL,
           delivered_at = NULL,
           correlation_id = _correlation_id,
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'redistributed', true,
             'source', _reason,
             'previous_driver_id', v_existing.driver_id,
             'previous_queue_position', v_queue.position
           ),
           updated_at = now()
     WHERE id = v_existing.id
    RETURNING id INTO v_assignment_id;

    INSERT INTO public.delivery_assignment_timeline (
      assignment_id, previous_state, current_state, actor, actor_id, reason, correlation_id, metadata
    ) VALUES (
      v_assignment_id, v_existing.status, 'ATRIBUIDO', 'restaurant', _actor_id,
      _reason, _correlation_id,
      jsonb_build_object(
        'redistributed', true,
        'previous_driver_id', v_existing.driver_id,
        'previous_queue_position', v_queue.position
      )
    );

    IF v_existing.driver_id <> v_queue.driver_id
       AND v_existing.status IN ('ATRIBUIDO','COLETANDO','EM_ROTA') THEN
      BEGIN
        PERFORM public.queue_return(v_order.restaurant_id, v_existing.driver_id);
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.delivery_auto_assignment_audit (
          order_id, assignment_id, restaurant_id, driver_id, reason, correlation_id, metadata
        ) VALUES (
          v_order.id, v_assignment_id, v_order.restaurant_id, v_existing.driver_id,
          'PREVIOUS_DRIVER_NOT_REQUEUED', _correlation_id,
          jsonb_build_object('error', SQLERRM, 'source', _reason)
        );
      END;
    END IF;
  END IF;

  PERFORM public.queue_dequeue(v_order.restaurant_id, v_queue.driver_id);

  SELECT name, address, delivery_fee
    INTO v_restaurant
    FROM public.restaurants
   WHERE id = v_order.restaurant_id;

  INSERT INTO public.notifications (
    recipient_id, recipient_type, channel, template_code, status, priority,
    payload_json, origin
  ) VALUES (
    v_queue.driver_owner, 'courier', 'IN_APP', 'DELIVERY_ASSIGNED', 'PENDING', 'HIGH',
    jsonb_build_object(
      'title', 'Nova entrega atribuida',
      'order_id', v_order.id,
      'assignment_id', v_assignment_id,
      'order_number', v_order.order_number,
      'pickup_address', COALESCE(v_restaurant.address, v_restaurant.name, ''),
      'delivery_address', COALESCE(v_order.address, ''),
      'delivery_value', NULL,
      'order_total', v_order.total,
      'correlation_id', _correlation_id
    ),
    'delivery_auto_assign_order'
  );

  INSERT INTO public.delivery_auto_assignment_audit (
    order_id, assignment_id, restaurant_id, driver_id, previous_queue_position,
    reason, correlation_id, metadata
  ) VALUES (
    v_order.id, v_assignment_id, v_order.restaurant_id, v_queue.driver_id,
    v_queue.position, 'ASSIGNED', _correlation_id,
    jsonb_build_object('source', _reason, 'forced_driver_id', _forced_driver_id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'ASSIGNED',
    'assignment_id', v_assignment_id,
    'driver_id', v_queue.driver_id,
    'previous_queue_position', v_queue.position,
    'correlation_id', _correlation_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_auto_assign_pending_for_restaurant(
  _restaurant_id UUID,
  _reason TEXT DEFAULT 'QUEUE_AVAILABLE',
  _correlation_id UUID DEFAULT gen_random_uuid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_result JSONB;
BEGIN
  FOR v_order IN
    SELECT o.id
      FROM public.orders o
     WHERE o.restaurant_id = _restaurant_id
       AND o.status = 'pronto'
       AND NOT EXISTS (
         SELECT 1 FROM public.delivery_assignments a
          WHERE a.order_id = o.id
            AND a.status IN ('ATRIBUIDO','COLETANDO','EM_ROTA','ENTREGUE')
       )
     ORDER BY o.updated_at ASC, o.created_at ASC
     LIMIT 25
  LOOP
    v_result := public.delivery_auto_assign_order(v_order.id, _reason, _correlation_id, NULL, NULL);
    IF COALESCE((v_result->>'ok')::boolean, false) THEN
      RETURN v_result || jsonb_build_object('pending_scan', true);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', false, 'reason', 'NO_PENDING_ORDER_OR_DRIVER');
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
  v_new_id UUID;
  v_pos INTEGER;
  v_corr UUID := gen_random_uuid();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant_id::text));

  SELECT *
    INTO v_existing
    FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id
     AND driver_id = _driver_id
     AND status <> 'INATIVO'
   FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    PERFORM public.queue_audit_insert(
      _restaurant_id, _driver_id, v_existing.id,
      COALESCE(v_existing.status, NULL), v_existing.status,
      v_existing.position, v_existing.position,
      'IDEMPOTENT', v_corr,
      jsonb_build_object('operation', 'queue_enqueue')
    );
    PERFORM public.delivery_auto_assign_pending_for_restaurant(_restaurant_id, 'QUEUE_AVAILABLE', v_corr);
    RETURN v_existing.id;
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
    _restaurant_id, _driver_id, v_new_id,
    NULL, 'AGUARDANDO', NULL, v_pos, 'ENTER', v_corr,
    jsonb_build_object('operation', 'queue_enqueue')
  );

  PERFORM public.delivery_auto_assign_pending_for_restaurant(_restaurant_id, 'QUEUE_AVAILABLE', v_corr);

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_auto_assign_order(UUID, TEXT, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_auto_assign_order(UUID, TEXT, UUID, UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.delivery_auto_assign_pending_for_restaurant(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_auto_assign_pending_for_restaurant(UUID, TEXT, UUID) TO service_role;
