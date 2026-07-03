
-- =========================================================
-- Product Domain — Foundation
-- =========================================================

-- product_versions -----------------------------------------
CREATE TABLE IF NOT EXISTS public.product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL,
  changes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version)
);

CREATE INDEX IF NOT EXISTS idx_product_versions_product ON public.product_versions(product_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_product_versions_restaurant ON public.product_versions(restaurant_id, created_at DESC);

GRANT SELECT, INSERT ON public.product_versions TO authenticated;
GRANT ALL ON public.product_versions TO service_role;

ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_versions owner read"
  ON public.product_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "product_versions owner insert"
  ON public.product_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

-- Immutability: block UPDATE / DELETE at trigger level (no policy = denied under RLS, but be explicit)
CREATE OR REPLACE FUNCTION public.tg_block_product_versions_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'product_versions is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_product_versions_update ON public.product_versions;
CREATE TRIGGER trg_block_product_versions_update
  BEFORE UPDATE OR DELETE ON public.product_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_product_versions_mutation();

-- product_media --------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'image' CHECK (type IN ('image','video','model_3d')),
  url text NOT NULL,
  storage_path text,
  display_order integer NOT NULL DEFAULT 0,
  alt_text text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_media_product ON public.product_media(product_id, display_order);
CREATE INDEX IF NOT EXISTS idx_product_media_restaurant ON public.product_media(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_media TO authenticated;
GRANT SELECT ON public.product_media TO anon;
GRANT ALL ON public.product_media TO service_role;

ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_media public read"
  ON public.product_media FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "product_media owner manage"
  ON public.product_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_product_media_updated_at ON public.product_media;
CREATE TRIGGER trg_product_media_updated_at
  BEFORE UPDATE ON public.product_media
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- product_audit --------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_audit_product ON public.product_audit(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_audit_restaurant ON public.product_audit(restaurant_id, created_at DESC);

GRANT SELECT, INSERT ON public.product_audit TO authenticated;
GRANT ALL ON public.product_audit TO service_role;

ALTER TABLE public.product_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_audit owner read"
  ON public.product_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "product_audit owner insert"
  ON public.product_audit FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));
