
CREATE POLICY "Authenticated can upload restaurant assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'restaurant-assets' AND owner = auth.uid());

CREATE POLICY "Authenticated can update own restaurant assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'restaurant-assets' AND owner = auth.uid());

CREATE POLICY "Authenticated can delete own restaurant assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'restaurant-assets' AND owner = auth.uid());

CREATE POLICY "Anyone can read restaurant assets"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'restaurant-assets');
