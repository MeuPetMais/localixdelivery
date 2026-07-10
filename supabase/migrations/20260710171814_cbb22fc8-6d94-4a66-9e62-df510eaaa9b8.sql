CREATE TABLE public.tracking_eta_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  order_id UUID NOT NULL,
  driver_id UUID,
  predicted_eta_seconds INTEGER NOT NULL,
  actual_eta_seconds INTEGER,
  difference_seconds INTEGER,
  confidence TEXT NOT NULL DEFAULT 'MEDIUM',
  algorithm TEXT NOT NULL DEFAULT 'distance',
  window_min_seconds INTEGER,
  window_max_seconds INTEGER,
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_eta_history_assignment ON public.tracking_eta_history(assignment_id, created_at DESC);
CREATE INDEX idx_tracking_eta_history_restaurant ON public.tracking_eta_history(restaurant_id, created_at DESC);

GRANT SELECT, INSERT ON public.tracking_eta_history TO authenticated;
GRANT ALL ON public.tracking_eta_history TO service_role;

ALTER TABLE public.tracking_eta_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners read own eta history"
  ON public.tracking_eta_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tracking_eta_history.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Drivers read own eta history"
  ON public.tracking_eta_history FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "Admins read all eta history"
  ON public.tracking_eta_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated insert eta history"
  ON public.tracking_eta_history FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid() OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));