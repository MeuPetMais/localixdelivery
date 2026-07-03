
-- Recipe status enum
DO $$ BEGIN
  CREATE TYPE public.recipe_status AS ENUM ('DRAFT','ACTIVE','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- product_recipes: BOM master
CREATE TABLE IF NOT EXISTS public.product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  yield_quantity NUMERIC NOT NULL DEFAULT 1,
  yield_unit TEXT NOT NULL DEFAULT 'un',
  preparation_time INTEGER,
  status public.recipe_status NOT NULL DEFAULT 'DRAFT',
  version INTEGER NOT NULL DEFAULT 1,
  variation_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_recipes TO authenticated;
GRANT ALL ON public.product_recipes TO service_role;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes_owner_all" ON public.product_recipes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_product_recipes_updated BEFORE UPDATE ON public.product_recipes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_product_recipes_rest ON public.product_recipes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_product ON public.product_recipes(product_id);

-- product_recipe_items
CREATE TABLE IF NOT EXISTS public.product_recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.product_recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'un',
  loss_percentage NUMERIC NOT NULL DEFAULT 0,
  optional BOOLEAN NOT NULL DEFAULT false,
  substitute_of UUID REFERENCES public.product_recipe_items(id) ON DELETE SET NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_recipe_items TO authenticated;
GRANT ALL ON public.product_recipe_items TO service_role;
ALTER TABLE public.product_recipe_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_items_owner_all" ON public.product_recipe_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.product_recipes pr JOIN public.restaurants r ON r.id = pr.restaurant_id
                 WHERE pr.id = recipe_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.product_recipes pr JOIN public.restaurants r ON r.id = pr.restaurant_id
                      WHERE pr.id = recipe_id AND r.owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON public.product_recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient ON public.product_recipe_items(ingredient_id);

-- Immutable version snapshots
CREATE TABLE IF NOT EXISTS public.product_recipe_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.product_recipes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  changed_by UUID,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, version)
);
GRANT SELECT, INSERT ON public.product_recipe_versions TO authenticated;
GRANT ALL ON public.product_recipe_versions TO service_role;
ALTER TABLE public.product_recipe_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_versions_owner_select" ON public.product_recipe_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.product_recipes pr JOIN public.restaurants r ON r.id = pr.restaurant_id
                 WHERE pr.id = recipe_id AND r.owner_id = auth.uid()));
CREATE POLICY "recipe_versions_owner_insert" ON public.product_recipe_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.product_recipes pr JOIN public.restaurants r ON r.id = pr.restaurant_id
                      WHERE pr.id = recipe_id AND r.owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe ON public.product_recipe_versions(recipe_id, version DESC);
