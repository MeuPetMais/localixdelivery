
CREATE TABLE IF NOT EXISTS public.customer_communication_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  marketing_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_communication_preferences TO authenticated;
GRANT ALL ON public.customer_communication_preferences TO service_role;

ALTER TABLE public.customer_communication_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cust_comm_prefs_own_select" ON public.customer_communication_preferences
  FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "cust_comm_prefs_own_insert" ON public.customer_communication_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "cust_comm_prefs_own_update" ON public.customer_communication_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "cust_comm_prefs_own_delete" ON public.customer_communication_preferences
  FOR DELETE TO authenticated USING (auth.uid() = customer_id);

CREATE TRIGGER trg_cust_comm_prefs_updated_at
  BEFORE UPDATE ON public.customer_communication_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.customer_communication_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'logged',
  reference_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cust_comm_history_customer_created
  ON public.customer_communication_history (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cust_comm_history_channel
  ON public.customer_communication_history (channel);

GRANT SELECT, INSERT ON public.customer_communication_history TO authenticated;
GRANT ALL ON public.customer_communication_history TO service_role;

ALTER TABLE public.customer_communication_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cust_comm_history_own_select" ON public.customer_communication_history
  FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "cust_comm_history_own_insert" ON public.customer_communication_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
