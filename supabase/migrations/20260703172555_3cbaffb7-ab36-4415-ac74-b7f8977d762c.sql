-- customer_timeline
CREATE TABLE IF NOT EXISTS public.customer_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  restaurant_id UUID,
  event_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_timeline_customer ON public.customer_timeline(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_timeline_type ON public.customer_timeline(event_type);
GRANT SELECT, INSERT ON public.customer_timeline TO authenticated;
GRANT ALL ON public.customer_timeline TO service_role;
ALTER TABLE public.customer_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own timeline" ON public.customer_timeline
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customers insert own timeline" ON public.customer_timeline
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

-- customer_preferences
CREATE TABLE IF NOT EXISTS public.customer_preferences (
  customer_id UUID PRIMARY KEY,
  preferred_payment_method TEXT,
  preferred_channel TEXT,
  preferred_category TEXT,
  dietary_restrictions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  language TEXT NOT NULL DEFAULT 'pt-BR',
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  push_opt_in BOOLEAN NOT NULL DEFAULT true,
  email_opt_in BOOLEAN NOT NULL DEFAULT true,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.customer_preferences TO authenticated;
GRANT ALL ON public.customer_preferences TO service_role;
ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers manage own preferences" ON public.customer_preferences
  FOR ALL TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE TRIGGER trg_customer_preferences_updated_at
  BEFORE UPDATE ON public.customer_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- customer_consents (LGPD)
CREATE TABLE IF NOT EXISTS public.customer_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  consent_type TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  source TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_consents_customer ON public.customer_consents(customer_id, consent_type, created_at DESC);
GRANT SELECT, INSERT ON public.customer_consents TO authenticated;
GRANT ALL ON public.customer_consents TO service_role;
ALTER TABLE public.customer_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own consents" ON public.customer_consents
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customers insert own consents" ON public.customer_consents
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());