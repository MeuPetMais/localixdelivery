DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;
CREATE POLICY "Public can view active restaurants"
ON public.restaurants
FOR SELECT
TO anon, authenticated
USING (active = true);