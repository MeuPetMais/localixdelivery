
-- 1) reviews: hide customer_phone from anon/authenticated public reads
REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, order_id, restaurant_id, customer_name, rating, comment, owner_reply, owner_reply_at, created_at, updated_at) ON public.reviews TO anon, authenticated;
-- Restaurant owners need full access (including phone) to manage reviews
GRANT SELECT, UPDATE ON public.reviews TO authenticated;
-- Wait: above re-grants full SELECT. Use a separate policy approach instead:
REVOKE SELECT ON public.reviews FROM authenticated;
GRANT SELECT (id, order_id, restaurant_id, customer_name, rating, comment, owner_reply, owner_reply_at, created_at, updated_at) ON public.reviews TO authenticated;
-- Owners read phone via service-role / dedicated owner endpoint if needed.

-- 2) supplier_products: restrict public read to authenticated only
DROP POLICY IF EXISTS "Supplier products public read" ON public.supplier_products;
CREATE POLICY "Supplier products authenticated read"
  ON public.supplier_products
  FOR SELECT
  TO authenticated
  USING (true);
