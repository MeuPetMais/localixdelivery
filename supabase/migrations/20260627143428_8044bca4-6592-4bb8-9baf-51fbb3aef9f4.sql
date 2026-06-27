CREATE POLICY "Public read product images" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Owner write product images" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.owner_id = auth.uid() AND (storage.foldername(name))[1] = r.id::text)
  );

CREATE POLICY "Owner update product images" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.owner_id = auth.uid() AND (storage.foldername(name))[1] = r.id::text)
  );

CREATE POLICY "Owner delete product images" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.owner_id = auth.uid() AND (storage.foldername(name))[1] = r.id::text)
  );
