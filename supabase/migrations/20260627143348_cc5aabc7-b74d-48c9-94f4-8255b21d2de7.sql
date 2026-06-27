-- New product fields
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS promo_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS prep_time_minutes integer,
  ADD COLUMN IF NOT EXISTS available_delivery boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_pickup boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bestseller boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Gallery
CREATE TABLE IF NOT EXISTS public.menu_item_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mii_item ON public.menu_item_images(menu_item_id, position);

GRANT SELECT ON public.menu_item_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_images TO authenticated;
GRANT ALL ON public.menu_item_images TO service_role;

ALTER TABLE public.menu_item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read images" ON public.menu_item_images FOR SELECT USING (true);
CREATE POLICY "Owner manages images" ON public.menu_item_images FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = menu_item_images.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = menu_item_images.restaurant_id AND r.owner_id = auth.uid()));
