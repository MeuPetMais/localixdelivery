
-- Restrict public exposure of restaurants.whatsapp_phone
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;

CREATE POLICY "Owners can view their restaurant"
  ON public.restaurants FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE OR REPLACE VIEW public.restaurants_public
WITH (security_invoker = on) AS
SELECT id, name, slug, description, logo_url, cover_url,
       delivery_fee, min_order, is_open, created_at, updated_at
FROM public.restaurants;

GRANT SELECT ON public.restaurants_public TO anon, authenticated;
