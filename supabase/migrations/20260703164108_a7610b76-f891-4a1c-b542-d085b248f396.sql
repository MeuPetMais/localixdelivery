
DROP POLICY IF EXISTS "promotion_usage_insert" ON public.promotion_usage;

CREATE POLICY "promotion_usage_insert_scoped" ON public.promotion_usage FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.promotions p
      WHERE p.id = promotion_id AND p.restaurant_id = promotion_usage.restaurant_id
    )
  );
