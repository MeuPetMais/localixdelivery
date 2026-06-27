
DROP POLICY IF EXISTS "Owner write product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner update product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete product images" ON storage.objects;

CREATE POLICY "Owner write product images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Owner update product images" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Owner delete product images" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
      AND r.id::text = (storage.foldername(storage.objects.name))[1]
  )
);
