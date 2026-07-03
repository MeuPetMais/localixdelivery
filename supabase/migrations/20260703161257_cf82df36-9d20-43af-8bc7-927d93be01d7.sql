
-- ============ catalog_menus ============
CREATE TABLE public.catalog_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  channel text NOT NULL DEFAULT 'delivery',
  status text NOT NULL DEFAULT 'draft',
  display_order int NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  available_days int[],
  available_start_time time,
  available_end_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_menus_rest ON public.catalog_menus(restaurant_id);
CREATE INDEX idx_catalog_menus_channel ON public.catalog_menus(restaurant_id, channel);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_menus TO authenticated;
GRANT ALL ON public.catalog_menus TO service_role;

ALTER TABLE public.catalog_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages catalog_menus"
ON public.catalog_menus FOR ALL
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = catalog_menus.restaurant_id AND r.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = catalog_menus.restaurant_id AND r.owner_id = auth.uid()));

CREATE TRIGGER trg_catalog_menus_updated_at
  BEFORE UPDATE ON public.catalog_menus
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ catalog_menu_categories ============
CREATE TABLE public.catalog_menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.catalog_menus(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_id, category_id)
);
CREATE INDEX idx_cmc_menu ON public.catalog_menu_categories(menu_id);
CREATE INDEX idx_cmc_rest ON public.catalog_menu_categories(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_menu_categories TO authenticated;
GRANT ALL ON public.catalog_menu_categories TO service_role;

ALTER TABLE public.catalog_menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages catalog_menu_categories"
ON public.catalog_menu_categories FOR ALL
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = catalog_menu_categories.restaurant_id AND r.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = catalog_menu_categories.restaurant_id AND r.owner_id = auth.uid()));

CREATE TRIGGER trg_cmc_updated_at
  BEFORE UPDATE ON public.catalog_menu_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ catalog_menu_products ============
CREATE TABLE public.catalog_menu_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.catalog_menus(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  channel_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_id, product_id)
);
CREATE INDEX idx_cmp_menu ON public.catalog_menu_products(menu_id);
CREATE INDEX idx_cmp_product ON public.catalog_menu_products(product_id);
CREATE INDEX idx_cmp_rest ON public.catalog_menu_products(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_menu_products TO authenticated;
GRANT ALL ON public.catalog_menu_products TO service_role;

ALTER TABLE public.catalog_menu_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages catalog_menu_products"
ON public.catalog_menu_products FOR ALL
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = catalog_menu_products.restaurant_id AND r.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = catalog_menu_products.restaurant_id AND r.owner_id = auth.uid()));

CREATE TRIGGER trg_cmp_updated_at
  BEFORE UPDATE ON public.catalog_menu_products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ catalog_events (auditoria interna) ============
CREATE TABLE public.catalog_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_id uuid REFERENCES public.catalog_menus(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_events_rest ON public.catalog_events(restaurant_id, created_at DESC);

GRANT SELECT, INSERT ON public.catalog_events TO authenticated;
GRANT ALL ON public.catalog_events TO service_role;

ALTER TABLE public.catalog_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads catalog_events"
ON public.catalog_events FOR SELECT
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = catalog_events.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Owner writes catalog_events"
ON public.catalog_events FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = catalog_events.restaurant_id AND r.owner_id = auth.uid()));
