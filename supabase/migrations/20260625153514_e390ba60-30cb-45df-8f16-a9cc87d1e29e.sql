CREATE TABLE public.customer_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone, restaurant_id)
);
GRANT SELECT, INSERT, DELETE ON public.customer_favorites TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.customer_favorites TO anon;
GRANT ALL ON public.customer_favorites TO service_role;
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;
-- Reads/writes go exclusively through server functions using service role.
-- Lock down direct client access. Service role bypasses RLS.
CREATE POLICY "no direct access" ON public.customer_favorites FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX idx_customer_favorites_phone ON public.customer_favorites(phone);