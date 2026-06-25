
-- Customers (CRM) table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  total_orders integer NOT NULL DEFAULT 0,
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  avg_ticket numeric(12,2) NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, phone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Only the restaurant owner can read/manage their customers
CREATE POLICY "Owners can view own customers"
ON public.customers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = customers.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Owners can update own customers"
ON public.customers FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = customers.restaurant_id AND r.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = customers.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Owners can delete own customers"
ON public.customers FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = customers.restaurant_id AND r.owner_id = auth.uid()));

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-upsert customer when an order is created
CREATE OR REPLACE FUNCTION private.upsert_customer_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := regexp_replace(coalesce(NEW.customer_phone,''), '\D', '', 'g');
BEGIN
  IF v_phone = '' OR NEW.customer_name IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.customers (restaurant_id, name, phone, total_orders, total_spent, avg_ticket, last_order_at)
  VALUES (NEW.restaurant_id, NEW.customer_name, v_phone, 1, coalesce(NEW.total,0), coalesce(NEW.total,0), NEW.created_at)
  ON CONFLICT (restaurant_id, phone) DO UPDATE
    SET name = EXCLUDED.name,
        total_orders = public.customers.total_orders + 1,
        total_spent = public.customers.total_spent + coalesce(NEW.total,0),
        avg_ticket = (public.customers.total_spent + coalesce(NEW.total,0)) / (public.customers.total_orders + 1),
        last_order_at = NEW.created_at,
        updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.upsert_customer_from_order() FROM PUBLIC;

CREATE TRIGGER trg_orders_upsert_customer
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.upsert_customer_from_order();

-- Backfill from existing orders
INSERT INTO public.customers (restaurant_id, name, phone, total_orders, total_spent, avg_ticket, last_order_at, created_at)
SELECT
  o.restaurant_id,
  (array_agg(o.customer_name ORDER BY o.created_at DESC))[1],
  regexp_replace(o.customer_phone, '\D', '', 'g') AS phone,
  count(*)::int,
  sum(coalesce(o.total,0)),
  avg(coalesce(o.total,0)),
  max(o.created_at),
  min(o.created_at)
FROM public.orders o
WHERE coalesce(o.customer_phone,'') <> '' AND o.customer_name IS NOT NULL
GROUP BY o.restaurant_id, regexp_replace(o.customer_phone, '\D', '', 'g')
ON CONFLICT (restaurant_id, phone) DO NOTHING;
