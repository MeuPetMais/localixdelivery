
-- 1. reviews: hide customer_phone from public reads
REVOKE ALL ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, restaurant_id, order_id, customer_name, rating, comment, owner_reply, owner_reply_at, created_at, updated_at)
  ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

-- 2. menu_items: only expose active, available, non-paused items publicly
DROP POLICY IF EXISTS "Public can view items" ON public.menu_items;
CREATE POLICY "Public can view active items"
  ON public.menu_items
  FOR SELECT
  USING (is_active = true AND COALESCE(is_paused, false) = false AND COALESCE(is_available, true) = true);

-- 3. menu_categories: only expose categories that contain at least one publicly-visible item
DROP POLICY IF EXISTS "Public can view categories" ON public.menu_categories;
CREATE POLICY "Public can view categories with active items"
  ON public.menu_categories
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.category_id = menu_categories.id
      AND mi.is_active = true
      AND COALESCE(mi.is_paused, false) = false
      AND COALESCE(mi.is_available, true) = true
  ));
