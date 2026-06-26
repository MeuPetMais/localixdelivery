-- Rebuild the safe public restaurant view with every field needed by the public profile tabs.
DROP VIEW IF EXISTS public.restaurants_public;
CREATE VIEW public.restaurants_public
WITH (security_invoker = on) AS
SELECT
  id,
  name,
  slug,
  description,
  logo_url,
  cover_url,
  delivery_fee,
  min_order,
  is_open,
  created_at,
  updated_at,
  address,
  address_number,
  complement,
  neighborhood,
  city,
  state,
  zip_code,
  category,
  primary_color,
  delivery_time,
  delivery_radius,
  avg_delivery_minutes,
  avg_pickup_minutes,
  opening_hours,
  instagram,
  facebook,
  website,
  email,
  latitude,
  longitude,
  google_maps_url,
  landline_phone,
  payment_methods
FROM public.restaurants
WHERE active = true;

GRANT SELECT ON public.restaurants_public TO anon, authenticated;

-- Because the view uses security_invoker, the public roles also need direct
-- column-level privileges on the exact safe columns used by the view.
GRANT SELECT (
  id,
  name,
  slug,
  description,
  logo_url,
  cover_url,
  delivery_fee,
  min_order,
  is_open,
  created_at,
  updated_at,
  address,
  address_number,
  complement,
  neighborhood,
  city,
  state,
  zip_code,
  category,
  primary_color,
  delivery_time,
  delivery_radius,
  avg_delivery_minutes,
  avg_pickup_minutes,
  opening_hours,
  instagram,
  facebook,
  website,
  email,
  latitude,
  longitude,
  google_maps_url,
  landline_phone,
  payment_methods,
  active
) ON public.restaurants TO anon, authenticated;

-- Keep a narrow public read policy so the security-invoker view can return
-- active establishments while column grants continue to protect sensitive fields.
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;
CREATE POLICY "Public can view active restaurants"
  ON public.restaurants
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Public profile reviews are intentionally visible on the storefront.
GRANT SELECT ON public.reviews TO anon, authenticated;