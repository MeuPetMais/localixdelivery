
-- Fase 1: novas colunas de endereço, contato e tempos
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS landline_phone text,
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS avg_delivery_minutes integer,
  ADD COLUMN IF NOT EXISTS avg_pickup_minutes integer;

-- Recriar view pública incluindo as novas colunas seguras
DROP VIEW IF EXISTS public.restaurants_public;
CREATE VIEW public.restaurants_public
WITH (security_invoker = on) AS
SELECT
  id, name, slug, description, logo_url, cover_url,
  delivery_fee, min_order, is_open, created_at, updated_at,
  address, address_number, complement, neighborhood, city, state, zip_code,
  category, primary_color, delivery_time, delivery_radius,
  avg_delivery_minutes, avg_pickup_minutes,
  opening_hours, instagram, facebook, website, email,
  latitude, longitude, google_maps_url, landline_phone,
  payment_methods
FROM public.restaurants
WHERE active = true;

GRANT SELECT ON public.restaurants_public TO anon, authenticated;

-- Garantir SELECT direto nas colunas novas (a view é security_invoker)
GRANT SELECT (
  id, name, slug, description, logo_url, cover_url,
  delivery_fee, min_order, is_open, created_at, updated_at,
  address, address_number, complement, neighborhood, city, state, zip_code,
  category, primary_color, delivery_time, delivery_radius,
  avg_delivery_minutes, avg_pickup_minutes,
  opening_hours, instagram, facebook, website, email,
  latitude, longitude, google_maps_url, landline_phone,
  payment_methods, active
) ON public.restaurants TO anon, authenticated;

-- Storage: políticas para o bucket restaurant-assets (dono gerencia, leitura pública via signed URL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='restaurant-assets owner insert') THEN
    CREATE POLICY "restaurant-assets owner insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'restaurant-assets' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='restaurant-assets owner update') THEN
    CREATE POLICY "restaurant-assets owner update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'restaurant-assets' AND owner = auth.uid())
      WITH CHECK (bucket_id = 'restaurant-assets' AND owner = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='restaurant-assets owner delete') THEN
    CREATE POLICY "restaurant-assets owner delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'restaurant-assets' AND owner = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='restaurant-assets read') THEN
    CREATE POLICY "restaurant-assets read" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'restaurant-assets');
  END IF;
END $$;
