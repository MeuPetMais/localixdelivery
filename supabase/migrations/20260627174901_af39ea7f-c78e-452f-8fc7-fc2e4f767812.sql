DROP POLICY IF EXISTS "Owners manage builders" ON public.builders;
CREATE POLICY "Owners manage builders"
ON public.builders
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = builders.restaurant_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = builders.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners manage groups" ON public.builder_groups;
CREATE POLICY "Owners manage groups"
ON public.builder_groups
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.builders b
    JOIN public.restaurants r ON r.id = b.restaurant_id
    WHERE b.id = builder_groups.builder_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.builders b
    JOIN public.restaurants r ON r.id = b.restaurant_id
    WHERE b.id = builder_groups.builder_id
      AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners manage options" ON public.builder_options;
CREATE POLICY "Owners manage options"
ON public.builder_options
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.builder_groups g
    JOIN public.builders b ON b.id = g.builder_id
    JOIN public.restaurants r ON r.id = b.restaurant_id
    WHERE g.id = builder_options.group_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.builder_groups g
    JOIN public.builders b ON b.id = g.builder_id
    JOIN public.restaurants r ON r.id = b.restaurant_id
    WHERE g.id = builder_options.group_id
      AND r.owner_id = auth.uid()
  )
);