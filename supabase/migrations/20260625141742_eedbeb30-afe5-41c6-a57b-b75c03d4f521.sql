
-- Customer points
CREATE TABLE public.customer_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_points TO authenticated;
GRANT ALL ON public.customer_points TO service_role;
ALTER TABLE public.customer_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view customer points"
ON public.customer_points FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.customers c JOIN public.restaurants r ON r.id = c.restaurant_id
  WHERE c.id = customer_points.customer_id AND r.owner_id = auth.uid()
));

CREATE TRIGGER trg_customer_points_updated_at
BEFORE UPDATE ON public.customer_points
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Coupons
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  valid_until date,
  is_active boolean NOT NULL DEFAULT true,
  uses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own coupons"
ON public.coupons FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = coupons.restaurant_id AND r.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = coupons.restaurant_id AND r.owner_id = auth.uid()));

CREATE TRIGGER trg_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Orders: add coupon + discount columns
ALTER TABLE public.orders
  ADD COLUMN coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN discount numeric(12,2) NOT NULL DEFAULT 0;

-- Loyalty trigger: award 1 point per R$1 spent (after customer upsert)
CREATE OR REPLACE FUNCTION private.award_points_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := regexp_replace(coalesce(NEW.customer_phone,''), '\D', '', 'g');
  v_customer_id uuid;
  v_points integer := floor(coalesce(NEW.total,0))::int;
BEGIN
  IF v_phone = '' OR v_points <= 0 THEN RETURN NEW; END IF;
  SELECT id INTO v_customer_id FROM public.customers
  WHERE restaurant_id = NEW.restaurant_id AND phone = v_phone LIMIT 1;
  IF v_customer_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.customer_points (customer_id, balance, total_earned)
  VALUES (v_customer_id, v_points, v_points)
  ON CONFLICT (customer_id) DO UPDATE
    SET balance = public.customer_points.balance + v_points,
        total_earned = public.customer_points.total_earned + v_points,
        updated_at = now();

  IF NEW.coupon_id IS NOT NULL THEN
    UPDATE public.coupons SET uses_count = uses_count + 1, updated_at = now()
    WHERE id = NEW.coupon_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.award_points_from_order() FROM PUBLIC;

CREATE TRIGGER trg_orders_award_points
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.award_points_from_order();

-- Backfill points from existing orders
INSERT INTO public.customer_points (customer_id, balance, total_earned)
SELECT c.id, floor(c.total_spent)::int, floor(c.total_spent)::int
FROM public.customers c
ON CONFLICT (customer_id) DO NOTHING;

-- Public coupon validation (anon-safe)
CREATE OR REPLACE FUNCTION public.validate_coupon(_slug text, _code text)
RETURNS TABLE (id uuid, discount_percent integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.id, cp.discount_percent
  FROM public.coupons cp
  JOIN public.restaurants r ON r.id = cp.restaurant_id
  WHERE r.slug = _slug
    AND upper(cp.code) = upper(_code)
    AND cp.is_active
    AND (cp.valid_until IS NULL OR cp.valid_until >= current_date)
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, text) TO anon, authenticated;
