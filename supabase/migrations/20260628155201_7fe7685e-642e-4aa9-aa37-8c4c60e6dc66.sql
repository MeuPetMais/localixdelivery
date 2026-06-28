
-- 1. Remove public read on base restaurants table (public storefront uses restaurants_public view)
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;
REVOKE SELECT ON public.restaurants FROM anon;

-- 2. Restrict customer_phone on reviews from public reads via column-level privileges
REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, restaurant_id, order_id, customer_name, rating, comment, owner_reply, owner_reply_at, created_at)
  ON public.reviews TO anon, authenticated;
-- Keep service_role unrestricted
GRANT ALL ON public.reviews TO service_role;

-- 3. Remove conflicting permissive policies on storage.objects for restaurant-assets bucket
DROP POLICY IF EXISTS "Authenticated can upload restaurant assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update own restaurant assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete own restaurant assets" ON storage.objects;
