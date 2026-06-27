
CREATE OR REPLACE FUNCTION public.is_builders_enabled(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT builders_enabled FROM public.restaurants WHERE id = _restaurant_id AND active = true), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_builders_enabled(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view active builders" ON public.builders;
CREATE POLICY "Public can view active builders" ON public.builders
  FOR SELECT
  USING (is_active = true AND public.is_builders_enabled(restaurant_id));

DROP POLICY IF EXISTS "Public can view groups" ON public.builder_groups;
CREATE POLICY "Public can view groups" ON public.builder_groups
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.builders b
    WHERE b.id = builder_groups.builder_id
      AND b.is_active = true
      AND public.is_builders_enabled(b.restaurant_id)
  ));

DROP POLICY IF EXISTS "Public can view options" ON public.builder_options;
CREATE POLICY "Public can view options" ON public.builder_options
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.builder_groups g
    JOIN public.builders b ON b.id = g.builder_id
    WHERE g.id = builder_options.group_id
      AND b.is_active = true
      AND public.is_builders_enabled(b.restaurant_id)
  ));
