
-- Product Configuration Engine
CREATE TYPE public.product_option_group_type AS ENUM ('SINGLE','MULTIPLE','QUANTITY','BOOLEAN');
CREATE TYPE public.product_price_strategy AS ENUM ('SUM','AVERAGE','MAX','FIXED','CUSTOM');

CREATE TABLE public.product_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type public.product_option_group_type NOT NULL DEFAULT 'SINGLE',
  min_selection INTEGER NOT NULL DEFAULT 0,
  max_selection INTEGER NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT false,
  price_strategy public.product_price_strategy NOT NULL DEFAULT 'SUM',
  display_order INTEGER NOT NULL DEFAULT 0,
  depends_on_group_id UUID REFERENCES public.product_option_groups(id) ON DELETE SET NULL,
  depends_on_option_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pog_product ON public.product_option_groups(product_id);

CREATE TABLE public.product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_adjustment NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_quantity INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  inventory_reference UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
  recipe_reference UUID REFERENCES public.product_recipes(id) ON DELETE SET NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_group ON public.product_options(group_id);

GRANT SELECT ON public.product_option_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_groups TO authenticated;
GRANT ALL ON public.product_option_groups TO service_role;
GRANT SELECT ON public.product_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_options TO authenticated;
GRANT ALL ON public.product_options TO service_role;

ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pog_public_read" ON public.product_option_groups FOR SELECT USING (true);
CREATE POLICY "pog_owner_all" ON public.product_option_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM public.menu_items mi JOIN public.restaurants r ON r.id=mi.restaurant_id WHERE mi.id=product_id AND r.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.menu_items mi JOIN public.restaurants r ON r.id=mi.restaurant_id WHERE mi.id=product_id AND r.owner_id=auth.uid()));

CREATE POLICY "po_public_read" ON public.product_options FOR SELECT USING (true);
CREATE POLICY "po_owner_all" ON public.product_options FOR ALL
  USING (EXISTS (SELECT 1 FROM public.product_option_groups g JOIN public.menu_items mi ON mi.id=g.product_id JOIN public.restaurants r ON r.id=mi.restaurant_id WHERE g.id=group_id AND r.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.product_option_groups g JOIN public.menu_items mi ON mi.id=g.product_id JOIN public.restaurants r ON r.id=mi.restaurant_id WHERE g.id=group_id AND r.owner_id=auth.uid()));

CREATE TRIGGER trg_pog_updated BEFORE UPDATE ON public.product_option_groups FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.product_options FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
