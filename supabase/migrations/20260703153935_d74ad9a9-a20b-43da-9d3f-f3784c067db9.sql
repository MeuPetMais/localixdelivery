-- financial_reports
CREATE TABLE IF NOT EXISTS public.financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ,
  file_format TEXT NOT NULL DEFAULT 'json',
  status TEXT NOT NULL DEFAULT 'PENDING',
  file_url TEXT,
  error TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_reports TO authenticated;
GRANT ALL ON public.financial_reports TO service_role;
ALTER TABLE public.financial_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages financial_reports"
  ON public.financial_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_financial_reports_rest ON public.financial_reports(restaurant_id, created_at DESC);

CREATE TRIGGER trg_financial_reports_updated_at
  BEFORE UPDATE ON public.financial_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- scheduled_reports
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL,
  report_type TEXT NOT NULL,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  export_format TEXT NOT NULL DEFAULT 'pdf',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_execution TIMESTAMPTZ,
  next_execution TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_reports TO authenticated;
GRANT ALL ON public.scheduled_reports TO service_role;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages scheduled_reports"
  ON public.scheduled_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_rest ON public.scheduled_reports(restaurant_id, enabled, next_execution);

CREATE TRIGGER trg_scheduled_reports_updated_at
  BEFORE UPDATE ON public.scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();