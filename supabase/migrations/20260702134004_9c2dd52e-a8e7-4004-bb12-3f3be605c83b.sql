
-- Weekly favorite flag on menu items
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_weekly_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_menu_items_weekly_favorite
  ON public.menu_items(restaurant_id) WHERE is_weekly_favorite = true;

-- Featured sections config (one row per restaurant)
CREATE TABLE IF NOT EXISTS public.featured_sections (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  promotions_enabled boolean NOT NULL DEFAULT true,
  weekly_favorites_enabled boolean NOT NULL DEFAULT true,
  top_rated_enabled boolean NOT NULL DEFAULT true,
  new_items_enabled boolean NOT NULL DEFAULT true,
  customer_favorites_enabled boolean NOT NULL DEFAULT true,
  half_half_pizza_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.featured_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.featured_sections TO authenticated;
GRANT ALL ON public.featured_sections TO service_role;

ALTER TABLE public.featured_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read featured sections"
  ON public.featured_sections FOR SELECT
  USING (true);

CREATE POLICY "Owners manage featured sections"
  ON public.featured_sections FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE TRIGGER tg_featured_sections_updated_at
  BEFORE UPDATE ON public.featured_sections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
