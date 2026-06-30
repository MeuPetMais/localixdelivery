DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_item_images; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.menu_categories REPLICA IDENTITY FULL;
ALTER TABLE public.menu_item_images REPLICA IDENTITY FULL;