ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
ALTER TABLE public.restaurants REPLICA IDENTITY FULL;