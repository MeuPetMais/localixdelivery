
-- header
CREATE TABLE public.tenant_configuration (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL UNIQUE,
  configuration_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_configuration TO authenticated;
GRANT ALL ON public.tenant_configuration TO service_role;
ALTER TABLE public.tenant_configuration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tc admin all" ON public.tenant_configuration FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tc owner all" ON public.tenant_configuration FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_configuration.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_configuration.restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_tc_upd BEFORE UPDATE ON public.tenant_configuration FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- helper macro via repeated pattern: each subtable keyed by restaurant_id
CREATE TABLE public.tenant_payment_settings (
  restaurant_id UUID NOT NULL PRIMARY KEY,
  accept_pix BOOLEAN NOT NULL DEFAULT true,
  accept_credit BOOLEAN NOT NULL DEFAULT true,
  accept_cash BOOLEAN NOT NULL DEFAULT true,
  accept_voucher BOOLEAN NOT NULL DEFAULT false,
  minimum_order NUMERIC(10,2) NOT NULL DEFAULT 0,
  maximum_order NUMERIC(10,2),
  payment_timeout_minutes INTEGER NOT NULL DEFAULT 15,
  default_gateway TEXT NOT NULL DEFAULT 'mercado_pago',
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  free_delivery_enabled BOOLEAN NOT NULL DEFAULT false,
  free_delivery_minimum NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_payment_settings TO authenticated;
GRANT ALL ON public.tenant_payment_settings TO service_role;
ALTER TABLE public.tenant_payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tps admin all" ON public.tenant_payment_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tps owner all" ON public.tenant_payment_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_payment_settings.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_payment_settings.restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_tps_upd BEFORE UPDATE ON public.tenant_payment_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.tenant_delivery_settings (
  restaurant_id UUID NOT NULL PRIMARY KEY,
  delivery_mode TEXT NOT NULL DEFAULT 'AUTO',
  delivery_radius_km NUMERIC(6,2) NOT NULL DEFAULT 5,
  estimated_preparation_time INTEGER NOT NULL DEFAULT 20,
  estimated_delivery_time INTEGER NOT NULL DEFAULT 35,
  accept_scheduled_orders BOOLEAN NOT NULL DEFAULT false,
  maximum_simultaneous_orders INTEGER NOT NULL DEFAULT 50,
  driver_assignment_mode TEXT NOT NULL DEFAULT 'AUTO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_delivery_settings TO authenticated;
GRANT ALL ON public.tenant_delivery_settings TO service_role;
ALTER TABLE public.tenant_delivery_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tds admin all" ON public.tenant_delivery_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tds owner all" ON public.tenant_delivery_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_delivery_settings.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_delivery_settings.restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_tds_upd BEFORE UPDATE ON public.tenant_delivery_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.tenant_business_settings (
  restaurant_id UUID NOT NULL PRIMARY KEY,
  business_status TEXT NOT NULL DEFAULT 'OPEN',
  accept_orders BOOLEAN NOT NULL DEFAULT true,
  automatic_order_acceptance BOOLEAN NOT NULL DEFAULT false,
  allow_cancellations BOOLEAN NOT NULL DEFAULT true,
  cancellation_time_limit INTEGER NOT NULL DEFAULT 5,
  working_hours_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  holidays_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  vacation_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_business_settings TO authenticated;
GRANT ALL ON public.tenant_business_settings TO service_role;
ALTER TABLE public.tenant_business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tbs admin all" ON public.tenant_business_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tbs owner all" ON public.tenant_business_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_business_settings.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_business_settings.restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_tbs_upd BEFORE UPDATE ON public.tenant_business_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.tenant_branding (
  restaurant_id UUID NOT NULL PRIMARY KEY,
  logo TEXT,
  primary_color TEXT DEFAULT '#f97316',
  secondary_color TEXT DEFAULT '#0f172a',
  banner TEXT,
  favicon TEXT,
  social_links_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_branding TO authenticated;
GRANT ALL ON public.tenant_branding TO service_role;
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tbr admin all" ON public.tenant_branding FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tbr owner all" ON public.tenant_branding FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_branding.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_branding.restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_tbr_upd BEFORE UPDATE ON public.tenant_branding FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.tenant_notifications (
  restaurant_id UUID NOT NULL PRIMARY KEY,
  notify_new_order BOOLEAN NOT NULL DEFAULT true,
  notify_cancelled_order BOOLEAN NOT NULL DEFAULT true,
  notify_payment BOOLEAN NOT NULL DEFAULT true,
  notify_delivery BOOLEAN NOT NULL DEFAULT true,
  notify_marketing BOOLEAN NOT NULL DEFAULT false,
  preferred_channels_json JSONB NOT NULL DEFAULT '["IN_APP"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_notifications TO authenticated;
GRANT ALL ON public.tenant_notifications TO service_role;
ALTER TABLE public.tenant_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tn admin all" ON public.tenant_notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tn owner all" ON public.tenant_notifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_notifications.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_notifications.restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_tn_upd BEFORE UPDATE ON public.tenant_notifications FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.tenant_features (
  restaurant_id UUID NOT NULL PRIMARY KEY,
  cashback_enabled BOOLEAN NOT NULL DEFAULT false,
  loyalty_enabled BOOLEAN NOT NULL DEFAULT false,
  coupons_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  analytics_enabled BOOLEAN NOT NULL DEFAULT true,
  marketing_enabled BOOLEAN NOT NULL DEFAULT false,
  subscriptions_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_features TO authenticated;
GRANT ALL ON public.tenant_features TO service_role;
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tf admin all" ON public.tenant_features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tf owner all" ON public.tenant_features FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_features.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_features.restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_tf_upd BEFORE UPDATE ON public.tenant_features FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- versioning + audit
CREATE TABLE public.tenant_config_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  group_name TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tcv_restaurant ON public.tenant_config_versions(restaurant_id, group_name, version DESC);
GRANT SELECT, INSERT ON public.tenant_config_versions TO authenticated;
GRANT ALL ON public.tenant_config_versions TO service_role;
ALTER TABLE public.tenant_config_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcv admin all" ON public.tenant_config_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tcv owner select" ON public.tenant_config_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_config_versions.restaurant_id AND r.owner_id = auth.uid()));
CREATE POLICY "tcv owner insert" ON public.tenant_config_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_config_versions.restaurant_id AND r.owner_id = auth.uid()));

CREATE TABLE public.tenant_config_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  group_name TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID,
  source TEXT DEFAULT 'panel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tca_restaurant ON public.tenant_config_audit(restaurant_id, created_at DESC);
GRANT SELECT, INSERT ON public.tenant_config_audit TO authenticated;
GRANT ALL ON public.tenant_config_audit TO service_role;
ALTER TABLE public.tenant_config_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tca admin all" ON public.tenant_config_audit FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tca owner select" ON public.tenant_config_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_config_audit.restaurant_id AND r.owner_id = auth.uid()));
CREATE POLICY "tca owner insert" ON public.tenant_config_audit FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tenant_config_audit.restaurant_id AND r.owner_id = auth.uid()));
