-- Ensure the storefront receives realtime updates when the owner toggles is_open.
-- Without this, public pages keep the previous status until a full reload.
ALTER TABLE public.restaurants REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'restaurants'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants';
  END IF;
END $$;