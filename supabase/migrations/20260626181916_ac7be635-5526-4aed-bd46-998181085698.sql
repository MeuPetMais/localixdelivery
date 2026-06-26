
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS facebook TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '{"cash":true,"pix":true,"credit":true,"debit":false,"meal_voucher":false,"food_voucher":false,"online_pix":false,"online_credit":false,"online_debit":false,"google_pay":false,"apple_pay":false}'::jsonb;

DROP VIEW IF EXISTS public.restaurants_public;
CREATE VIEW public.restaurants_public
WITH (security_invoker = true)
AS
SELECT
  id, name, slug, description, logo_url, cover_url,
  delivery_fee, min_order, is_open, created_at, updated_at,
  address, category, primary_color, delivery_time, delivery_radius,
  opening_hours, instagram, facebook, website, email,
  latitude, longitude, payment_methods
FROM public.restaurants
WHERE active = true;

GRANT SELECT ON public.restaurants_public TO anon, authenticated;
