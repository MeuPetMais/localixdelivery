
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS promo_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_campaign text;

-- Also expose promo fields in public view if it exists (recreate keeping promo_price)
-- (No-op if view already returns these fields.)

CREATE INDEX IF NOT EXISTS menu_items_promo_active_idx
  ON public.menu_items (restaurant_id)
  WHERE promo_price IS NOT NULL;
