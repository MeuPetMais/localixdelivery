-- 1) Fix SUPA_security_definer_view: switch view back to security_invoker
-- and authorize access via a narrow RLS policy + column-level grants on the
-- underlying restaurants table.
ALTER VIEW public.restaurants_public SET (security_invoker = on);

-- Public SELECT policy on restaurants limited to active rows.
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;
CREATE POLICY "Public can view active restaurants"
  ON public.restaurants
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Revoke any prior table-wide SELECT for public roles so sensitive columns
-- (owner_id, cnpj, phone, etc.) are not exposed.
REVOKE SELECT ON public.restaurants FROM anon;
REVOKE SELECT ON public.restaurants FROM authenticated;

-- Grant SELECT only on safe public columns matching restaurants_public.
GRANT SELECT (
  id, name, slug, description, logo_url, cover_url, delivery_fee, min_order,
  is_open, created_at, updated_at, address, address_number, complement,
  neighborhood, city, state, zip_code, category, primary_color, delivery_time,
  delivery_radius, avg_delivery_minutes, avg_pickup_minutes, opening_hours,
  instagram, facebook, website, email, latitude, longitude, google_maps_url,
  landline_phone, payment_methods, builders_enabled, active, owner_id
) ON public.restaurants TO anon, authenticated;
-- Note: active and owner_id are included so RLS policies referencing them
-- (and owner-scoped policies on related tables) continue to evaluate.

GRANT SELECT ON public.restaurants_public TO anon, authenticated;

-- 2) Fix reviews_public_phone_exposure: drop the policy with USING(true) and
-- replace with a column-restricted public read path.
DROP POLICY IF EXISTS "Reviews are publicly readable" ON public.reviews;

CREATE POLICY "Public can view review content"
  ON public.reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Ensure no table-wide SELECT is granted; only safe columns are exposed.
REVOKE SELECT ON public.reviews FROM anon;
REVOKE SELECT ON public.reviews FROM authenticated;

GRANT SELECT (
  id, restaurant_id, order_id, customer_name, rating, comment,
  owner_reply, owner_reply_at, created_at, updated_at
) ON public.reviews TO anon, authenticated;
-- customer_phone intentionally omitted.

-- 3) Fix coupons_missing_anon_read_but_code_leakable:
-- Coupons should never be read by anon; validation is server-side.
-- Owners read/write via the existing owner-scoped ALL policy on `authenticated`.
REVOKE ALL ON public.coupons FROM anon;