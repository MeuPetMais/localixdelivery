
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS t
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE c.relkind='r' AND n.nspname='public'
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.t);
  END LOOP;
END $$;

-- Public read (anon) — only tables with permissive public SELECT policies
GRANT SELECT ON public.restaurants       TO anon;
GRANT SELECT ON public.menu_categories   TO anon;
GRANT SELECT ON public.menu_items        TO anon;
GRANT SELECT ON public.menu_item_images  TO anon;
GRANT SELECT ON public.builders          TO anon;
GRANT SELECT ON public.builder_groups    TO anon;
GRANT SELECT ON public.builder_options   TO anon;
GRANT SELECT ON public.reviews           TO anon;

-- Restaurants public view (if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='restaurants_public') THEN
    EXECUTE 'GRANT SELECT ON public.restaurants_public TO anon, authenticated';
  END IF;
END $$;

-- Sequences (needed for INSERTs on tables using serial/bigserial)
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', s.sequence_name);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', s.sequence_name);
  END LOOP;
END $$;
