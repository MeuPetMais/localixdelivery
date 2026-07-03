
CREATE TABLE public.business_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  configuration_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_rules TO authenticated;
GRANT ALL ON public.business_rules TO service_role;
ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage business_rules"
  ON public.business_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_business_rules_updated
  BEFORE UPDATE ON public.business_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.business_rule_execution_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_code TEXT NOT NULL,
  order_id UUID,
  customer_id UUID,
  restaurant_id UUID,
  result TEXT NOT NULL,
  reason TEXT,
  execution_time_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.business_rule_execution_log TO authenticated;
GRANT ALL ON public.business_rule_execution_log TO service_role;
ALTER TABLE public.business_rule_execution_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins view rule logs"
  ON public.business_rule_execution_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service inserts rule logs"
  ON public.business_rule_execution_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_bre_log_rule ON public.business_rule_execution_log(rule_code, created_at DESC);
CREATE INDEX idx_bre_log_order ON public.business_rule_execution_log(order_id);
CREATE INDEX idx_bre_rules_category ON public.business_rules(category, enabled, priority);
