
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS orders_restaurant_order_number_uidx
  ON public.orders(restaurant_id, order_number);

CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.order_number IS NULL THEN
    SELECT COALESCE(MAX(order_number), 1000) + 1
      INTO next_num
      FROM public.orders
      WHERE restaurant_id = NEW.restaurant_id;
    NEW.order_number := next_num;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_assign_number ON public.orders;
CREATE TRIGGER trg_orders_assign_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_order_number();

-- Backfill existing rows per restaurant ordered by created_at
WITH numbered AS (
  SELECT id, restaurant_id,
         1000 + ROW_NUMBER() OVER (PARTITION BY restaurant_id ORDER BY created_at) AS n
  FROM public.orders
  WHERE order_number IS NULL
)
UPDATE public.orders o
SET order_number = numbered.n
FROM numbered
WHERE o.id = numbered.id;
