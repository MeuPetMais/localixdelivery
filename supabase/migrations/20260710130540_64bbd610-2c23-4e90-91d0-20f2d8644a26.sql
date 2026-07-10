
-- ================================================================
-- delivery_assignments
-- ================================================================
CREATE TABLE public.delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE','ATRIBUIDO','COLETANDO','EM_ROTA','ENTREGUE','CANCELADO')),
  assigned_by UUID,
  assigned_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  departed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  estimated_minutes INTEGER,
  distance_km NUMERIC(8,3),
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT delivery_assignments_order_unique UNIQUE (order_id)
);

CREATE INDEX delivery_assignments_restaurant_idx ON public.delivery_assignments(restaurant_id, status);
CREATE INDEX delivery_assignments_driver_idx    ON public.delivery_assignments(driver_id, status);
CREATE INDEX delivery_assignments_correlation_idx ON public.delivery_assignments(correlation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_assignments TO authenticated;
GRANT ALL ON public.delivery_assignments TO service_role;

ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

-- Restaurante (dono) — CRUD do próprio restaurante
CREATE POLICY "Owner manages own restaurant assignments"
  ON public.delivery_assignments FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

-- Motoboy — leitura da própria entrega
CREATE POLICY "Driver reads own assignment"
  ON public.delivery_assignments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = driver_id AND d.owner_id = auth.uid()));

-- Admin
CREATE POLICY "Admin full access assignments"
  ON public.delivery_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_delivery_assignments_updated_at
  BEFORE UPDATE ON public.delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ================================================================
-- delivery_timeline
-- ================================================================
CREATE TABLE public.delivery_assignment_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.delivery_assignments(id) ON DELETE CASCADE,
  previous_state TEXT,
  current_state TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_id UUID,
  reason TEXT,
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX delivery_assignment_timeline_assignment_idx
  ON public.delivery_assignment_timeline(assignment_id, created_at);

GRANT SELECT, INSERT ON public.delivery_assignment_timeline TO authenticated;
GRANT ALL ON public.delivery_assignment_timeline TO service_role;

ALTER TABLE public.delivery_assignment_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own timeline"
  ON public.delivery_assignment_timeline FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_assignments a
    JOIN public.restaurants r ON r.id = a.restaurant_id
    WHERE a.id = assignment_id AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Driver reads own timeline"
  ON public.delivery_assignment_timeline FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_assignments a
    JOIN public.delivery_drivers d ON d.id = a.driver_id
    WHERE a.id = assignment_id AND d.owner_id = auth.uid()
  ));

CREATE POLICY "Admin reads all timeline"
  ON public.delivery_assignment_timeline FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Inserção controlada pelo service role / RPC SECURITY DEFINER
CREATE POLICY "Owner inserts timeline via app"
  ON public.delivery_assignment_timeline FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.delivery_assignments a
    JOIN public.restaurants r ON r.id = a.restaurant_id
    WHERE a.id = assignment_id AND r.owner_id = auth.uid()
  ));

-- ================================================================
-- RPC atômica (CAS)
-- ================================================================
CREATE OR REPLACE FUNCTION public.delivery_assignment_apply_transition(
  _assignment_id UUID,
  _expected_from TEXT,
  _next_status TEXT,
  _actor TEXT,
  _actor_id UUID,
  _reason TEXT,
  _correlation_id UUID,
  _metadata JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current TEXT;
  v_now TIMESTAMPTZ := now();
  v_history_id UUID;
BEGIN
  SELECT status INTO v_current
    FROM public.delivery_assignments
   WHERE id = _assignment_id
   FOR UPDATE;

  IF v_current IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ASSIGNMENT_NOT_FOUND');
  END IF;

  IF v_current <> _expected_from THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'STATE_MISMATCH',
      'current', v_current, 'expected', _expected_from);
  END IF;

  UPDATE public.delivery_assignments
     SET status = _next_status,
         assigned_at  = CASE WHEN _next_status = 'ATRIBUIDO'  AND assigned_at  IS NULL THEN v_now ELSE assigned_at END,
         picked_up_at = CASE WHEN _next_status = 'COLETANDO'  AND picked_up_at IS NULL THEN v_now ELSE picked_up_at END,
         departed_at  = CASE WHEN _next_status = 'EM_ROTA'    AND departed_at  IS NULL THEN v_now ELSE departed_at END,
         delivered_at = CASE WHEN _next_status = 'ENTREGUE'   AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
         updated_at   = v_now
   WHERE id = _assignment_id;

  INSERT INTO public.delivery_assignment_timeline (
    assignment_id, previous_state, current_state, actor, actor_id, reason, correlation_id, metadata
  ) VALUES (
    _assignment_id, v_current, _next_status, _actor, _actor_id, _reason, _correlation_id, COALESCE(_metadata,'{}'::jsonb)
  ) RETURNING id INTO v_history_id;

  RETURN jsonb_build_object(
    'ok', true, 'previous', v_current, 'current', _next_status, 'history_id', v_history_id
  );
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_assignment_timeline;
