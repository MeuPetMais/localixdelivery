-- Restore dashboard owner access while preserving safe public access.

-- Partner dashboard needs authenticated owners to manage their own restaurant rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;

-- Public storefronts must use only the safe public projection.
GRANT SELECT ON public.restaurants_public TO anon, authenticated;
GRANT ALL ON public.restaurants_public TO service_role;

-- Because restaurants_public is security-invoker, grant only safe underlying columns
-- needed by the view to public API roles.
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
  builders_enabled
) ON public.restaurants TO anon, authenticated;

-- Keep the public-read policy restricted to anonymous storefront reads.
-- Authenticated owners are covered by their owner-specific policy.
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;
CREATE POLICY "Anonymous visitors can view active public restaurants"
ON public.restaurants
FOR SELECT
TO anon
USING (active = true);

-- Ensure owner policies exist and are scoped to the authenticated owner.
DROP POLICY IF EXISTS "Owners can view their restaurant" ON public.restaurants;
CREATE POLICY "Owners can view their restaurant"
ON public.restaurants
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners insert their restaurant" ON public.restaurants;
CREATE POLICY "Owners insert their restaurant"
ON public.restaurants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners update their restaurant" ON public.restaurants;
CREATE POLICY "Owners update their restaurant"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners delete their restaurant" ON public.restaurants;
CREATE POLICY "Owners delete their restaurant"
ON public.restaurants
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);