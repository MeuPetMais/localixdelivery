
DROP TABLE IF EXISTS public.customer_favorites CASCADE;

CREATE TABLE public.customer_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('menu_item','builder')),
  item_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (customer_id, item_kind, item_id)
);

CREATE INDEX idx_cust_fav_customer ON public.customer_favorites(customer_id);
CREATE INDEX idx_cust_fav_restaurant ON public.customer_favorites(restaurant_id);
CREATE INDEX idx_cust_fav_item ON public.customer_favorites(item_kind, item_id);

GRANT SELECT, INSERT, DELETE ON public.customer_favorites TO authenticated;
GRANT ALL ON public.customer_favorites TO service_role;

ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own favorites"
  ON public.customer_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers insert own favorites"
  ON public.customer_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers delete own favorites"
  ON public.customer_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = customer_id);
