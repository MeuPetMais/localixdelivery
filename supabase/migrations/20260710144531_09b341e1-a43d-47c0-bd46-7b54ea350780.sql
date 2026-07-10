
CREATE TABLE public.driver_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','PAUSADO','FINALIZADO')),
  current_state TEXT NOT NULL DEFAULT 'ONLINE' CHECK (current_state IN ('ONLINE','AGUARDANDO','EM_ENTREGA','RETORNANDO','PAUSA','OFFLINE')),
  deliveries_count INT NOT NULL DEFAULT 0,
  earnings_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  distance_total_km NUMERIC(12,2) NOT NULL DEFAULT 0,
  online_minutes INT NOT NULL DEFAULT 0,
  waiting_minutes INT NOT NULL DEFAULT 0,
  delivery_minutes INT NOT NULL DEFAULT 0,
  return_minutes INT NOT NULL DEFAULT 0,
  pause_minutes INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_shifts TO authenticated;
GRANT ALL ON public.driver_shifts TO service_role;

ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX driver_shifts_one_open_per_driver
  ON public.driver_shifts(driver_id)
  WHERE status <> 'FINALIZADO';

CREATE INDEX driver_shifts_driver_started_idx ON public.driver_shifts(driver_id, started_at DESC);
CREATE INDEX driver_shifts_restaurant_status_idx ON public.driver_shifts(restaurant_id, status);

CREATE POLICY "Driver reads own shifts" ON public.driver_shifts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = driver_id AND d.owner_id = auth.uid()));

CREATE POLICY "Driver inserts own shifts" ON public.driver_shifts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = driver_id AND d.owner_id = auth.uid()));

CREATE POLICY "Driver updates own shifts" ON public.driver_shifts
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = driver_id AND d.owner_id = auth.uid()));

CREATE POLICY "Restaurant reads its drivers shifts" ON public.driver_shifts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Admin full access driver_shifts" ON public.driver_shifts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_driver_shifts_updated_at
  BEFORE UPDATE ON public.driver_shifts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.driver_shift_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.driver_shifts(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  previous_state TEXT,
  current_state TEXT,
  actor TEXT NOT NULL DEFAULT 'driver',
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.driver_shift_timeline TO authenticated;
GRANT ALL ON public.driver_shift_timeline TO service_role;

ALTER TABLE public.driver_shift_timeline ENABLE ROW LEVEL SECURITY;

CREATE INDEX driver_shift_timeline_shift_idx ON public.driver_shift_timeline(shift_id, created_at DESC);

CREATE POLICY "Driver reads own shift timeline" ON public.driver_shift_timeline
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.driver_shifts s
    JOIN public.delivery_drivers d ON d.id = s.driver_id
    WHERE s.id = shift_id AND d.owner_id = auth.uid()
  ));

CREATE POLICY "Restaurant reads timeline of its drivers" ON public.driver_shift_timeline
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.driver_shifts s
    JOIN public.restaurants r ON r.id = s.restaurant_id
    WHERE s.id = shift_id AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Driver inserts own shift timeline" ON public.driver_shift_timeline
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.driver_shifts s
    JOIN public.delivery_drivers d ON d.id = s.driver_id
    WHERE s.id = shift_id AND d.owner_id = auth.uid()
  ));

CREATE POLICY "Admin full access driver_shift_timeline" ON public.driver_shift_timeline
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_shift_timeline;
