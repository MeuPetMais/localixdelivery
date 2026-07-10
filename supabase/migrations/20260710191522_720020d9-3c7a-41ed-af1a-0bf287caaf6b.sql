DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tracking_eta_history') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_eta_history';
  END IF;
END $$;
ALTER TABLE public.tracking_snapshots REPLICA IDENTITY FULL;
ALTER TABLE public.tracking_timeline REPLICA IDENTITY FULL;
ALTER TABLE public.tracking_eta_history REPLICA IDENTITY FULL;