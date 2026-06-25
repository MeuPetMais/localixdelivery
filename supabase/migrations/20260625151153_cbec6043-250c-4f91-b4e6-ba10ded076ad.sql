
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS manager_name text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON public.restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_category ON public.restaurants(category);
