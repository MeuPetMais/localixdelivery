DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Authenticated can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;

CREATE POLICY "Public can view active restaurants"
  ON public.restaurants
  FOR SELECT
  TO anon, authenticated
  USING (active = true);