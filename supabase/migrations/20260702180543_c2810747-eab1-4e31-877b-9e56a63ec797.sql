
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  name text NOT NULL DEFAULT 'Localix Delivery',
  logo_url text,
  banner_url text,
  primary_color text DEFAULT '#f97316',
  contact_email text,
  contact_whatsapp text,
  domain text,
  commission_rate numeric(6,4) NOT NULL DEFAULT 0.05,
  fixed_fee numeric(10,2) NOT NULL DEFAULT 0.99,
  min_order numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee_default numeric(10,2) NOT NULL DEFAULT 0,
  tier_fees jsonb NOT NULL DEFAULT '[]'::jsonb,
  city_fees jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read platform_settings" ON public.platform_settings;
CREATE POLICY "admins read platform_settings" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins update platform_settings" ON public.platform_settings;
CREATE POLICY "admins update platform_settings" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS commission_rate numeric(6,4),
  ADD COLUMN IF NOT EXISTS fixed_fee numeric(10,2),
  ADD COLUMN IF NOT EXISTS platform_fee numeric(10,2);

CREATE OR REPLACE FUNCTION public.tg_orders_snapshot_platform_fees()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rate numeric; v_fixed numeric;
BEGIN
  IF NEW.commission_rate IS NULL OR NEW.fixed_fee IS NULL THEN
    SELECT commission_rate, fixed_fee INTO v_rate, v_fixed
      FROM public.platform_settings WHERE id = true;
    NEW.commission_rate := COALESCE(NEW.commission_rate, v_rate, 0.05);
    NEW.fixed_fee := COALESCE(NEW.fixed_fee, v_fixed, 0.99);
  END IF;
  NEW.platform_fee := COALESCE(NEW.total, 0) * NEW.commission_rate + NEW.fixed_fee;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_snapshot_platform_fees ON public.orders;
CREATE TRIGGER orders_snapshot_platform_fees
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_snapshot_platform_fees();

DROP TRIGGER IF EXISTS platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
