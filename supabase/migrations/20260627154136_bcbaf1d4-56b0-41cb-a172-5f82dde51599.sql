
-- 1) orders: remove anon/public read by id
DROP POLICY IF EXISTS "Public can view orders by id" ON public.orders;

-- 2) restaurants: drop base-table public SELECT; public access via restaurants_public view only
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;

-- 3) suppliers: restrict to authenticated only
DROP POLICY IF EXISTS "Suppliers are public read" ON public.suppliers;
CREATE POLICY "Suppliers readable by authenticated"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (active = true);

-- 4) reviews: tie reviewer to original order via customer_phone match (digits only)
DROP POLICY IF EXISTS "Customers can review delivered orders" ON public.reviews;
CREATE POLICY "Customers can review their delivered orders"
  ON public.reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = reviews.order_id
        AND o.restaurant_id = reviews.restaurant_id
        AND o.status = 'entregue'
        AND regexp_replace(COALESCE(o.customer_phone, ''), '\D', '', 'g')
            = regexp_replace(COALESCE(reviews.customer_phone, ''), '\D', '', 'g')
        AND length(regexp_replace(COALESCE(reviews.customer_phone, ''), '\D', '', 'g')) >= 10
    )
  );

-- 5) storage: restrict restaurant-assets uploads to owner's restaurant folder
DROP POLICY IF EXISTS "restaurant-assets owner insert" ON storage.objects;
CREATE POLICY "restaurant-assets owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-assets'
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_id = auth.uid()
        AND r.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

-- Also tighten UPDATE on restaurant-assets to the same path-ownership rule
-- (existing policy relied on storage.objects.owner which may be null for some uploads)
DROP POLICY IF EXISTS "restaurant-assets owner update" ON storage.objects;
CREATE POLICY "restaurant-assets owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'restaurant-assets'
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_id = auth.uid()
        AND r.id::text = (storage.foldername(storage.objects.name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'restaurant-assets'
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_id = auth.uid()
        AND r.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

DROP POLICY IF EXISTS "restaurant-assets owner delete" ON storage.objects;
CREATE POLICY "restaurant-assets owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'restaurant-assets'
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_id = auth.uid()
        AND r.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );
