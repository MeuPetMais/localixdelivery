
CREATE TABLE public.financial_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('receita','despesa')),
  category text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_movements TO authenticated;
GRANT ALL ON public.financial_movements TO service_role;

ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their movements"
ON public.financial_movements
FOR ALL
TO authenticated
USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()))
WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));

CREATE INDEX idx_financial_movements_restaurant_date ON public.financial_movements(restaurant_id, movement_date DESC);

CREATE TRIGGER trg_financial_movements_updated_at
BEFORE UPDATE ON public.financial_movements
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
