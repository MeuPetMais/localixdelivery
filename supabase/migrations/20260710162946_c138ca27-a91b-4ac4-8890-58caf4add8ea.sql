
-- ============================================================
-- RC5.3.a — Tracking Core: snapshots + timeline
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tracking_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL UNIQUE REFERENCES public.delivery_assignments(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  eta_seconds INTEGER,
  confidence TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_speed DOUBLE PRECISION,
  last_heading DOUBLE PRECISION,
  last_seen_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracking_snapshots_restaurant_idx ON public.tracking_snapshots(restaurant_id, status);
CREATE INDEX IF NOT EXISTS tracking_snapshots_driver_idx ON public.tracking_snapshots(driver_id);
CREATE INDEX IF NOT EXISTS tracking_snapshots_order_idx ON public.tracking_snapshots(order_id);
CREATE INDEX IF NOT EXISTS tracking_snapshots_correlation_idx ON public.tracking_snapshots(correlation_id);

GRANT SELECT ON public.tracking_snapshots TO authenticated;
GRANT ALL ON public.tracking_snapshots TO service_role;

ALTER TABLE public.tracking_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access tracking snapshots" ON public.tracking_snapshots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Restaurant reads own tracking snapshots" ON public.tracking_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = tracking_snapshots.restaurant_id AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Driver reads own tracking snapshot" ON public.tracking_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_drivers d
    WHERE d.id = tracking_snapshots.driver_id AND d.owner_id = auth.uid()
  ));

CREATE POLICY "Customer reads own tracking snapshot" ON public.tracking_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = tracking_snapshots.order_id AND o.customer_id = auth.uid()
  ));

CREATE TRIGGER trg_tracking_snapshots_updated_at
  BEFORE UPDATE ON public.tracking_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- Timeline (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tracking_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.delivery_assignments(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  previous_status TEXT,
  current_status TEXT,
  actor TEXT NOT NULL DEFAULT 'system',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracking_timeline_assignment_idx ON public.tracking_timeline(assignment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tracking_timeline_restaurant_idx ON public.tracking_timeline(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tracking_timeline_order_idx ON public.tracking_timeline(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tracking_timeline_correlation_idx ON public.tracking_timeline(correlation_id);

GRANT SELECT ON public.tracking_timeline TO authenticated;
GRANT ALL ON public.tracking_timeline TO service_role;

ALTER TABLE public.tracking_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access tracking timeline" ON public.tracking_timeline
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Restaurant reads own tracking timeline" ON public.tracking_timeline
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = tracking_timeline.restaurant_id AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Driver reads own tracking timeline" ON public.tracking_timeline
  FOR SELECT TO authenticated
  USING (
    driver_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.delivery_drivers d
      WHERE d.id = tracking_timeline.driver_id AND d.owner_id = auth.uid()
    )
  );

CREATE POLICY "Customer reads own tracking timeline" ON public.tracking_timeline
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = tracking_timeline.order_id AND o.customer_id = auth.uid()
  ));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_timeline;
