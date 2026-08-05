CREATE TABLE IF NOT EXISTS public.driver_earning_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  base_fee numeric(10,2) NOT NULL DEFAULT 8.00,
  per_km_fee numeric(10,2) NOT NULL DEFAULT 1.50,
  minimum_fee numeric(10,2) NOT NULL DEFAULT 8.00,
  maximum_fee numeric(10,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_earning_settings_non_negative CHECK (
    base_fee >= 0
    AND per_km_fee >= 0
    AND minimum_fee >= 0
    AND (maximum_fee IS NULL OR maximum_fee >= 0)
  )
);

CREATE TRIGGER trg_driver_earning_settings_updated_at
  BEFORE UPDATE ON public.driver_earning_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.driver_earning_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners read driver earning settings"
  ON public.driver_earning_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = driver_earning_settings.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners upsert driver earning settings"
  ON public.driver_earning_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = driver_earning_settings.restaurant_id
      AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = driver_earning_settings.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage driver earning settings"
  ON public.driver_earning_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE ON public.driver_earning_settings TO authenticated;
GRANT ALL ON public.driver_earning_settings TO service_role;

ALTER TABLE public.delivery_assignments
  ADD COLUMN IF NOT EXISTS driver_base_fee numeric(10,2),
  ADD COLUMN IF NOT EXISTS driver_per_km_fee numeric(10,2),
  ADD COLUMN IF NOT EXISTS driver_distance_km numeric(8,3),
  ADD COLUMN IF NOT EXISTS driver_earning_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS driver_earning_calculated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_driver_earning_calculated
  ON public.delivery_assignments(driver_id, delivered_at DESC)
  WHERE driver_earning_amount IS NOT NULL;
