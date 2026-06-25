
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT 'orange',
  ADD COLUMN IF NOT EXISTS delivery_time text,
  ADD COLUMN IF NOT EXISTS delivery_radius numeric(6,2),
  ADD COLUMN IF NOT EXISTS opening_hours jsonb;
