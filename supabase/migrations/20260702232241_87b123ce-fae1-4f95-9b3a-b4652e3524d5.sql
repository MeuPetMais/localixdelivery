
-- order_payment
CREATE TABLE IF NOT EXISTS public.order_payment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mercado_pago',
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  external_reference TEXT,
  payment_intent TEXT,
  payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_payment_order ON public.order_payment(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payment_restaurant ON public.order_payment(restaurant_id);

GRANT SELECT ON public.order_payment TO authenticated;
GRANT ALL ON public.order_payment TO service_role;
ALTER TABLE public.order_payment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their restaurant payments"
  ON public.order_payment FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = order_payment.restaurant_id AND r.owner_id = auth.uid()));

CREATE TRIGGER trg_order_payment_updated_at
  BEFORE UPDATE ON public.order_payment
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- order_pricing_snapshot
CREATE TABLE IF NOT EXISTS public.order_pricing_snapshot (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  subtotal NUMERIC(12,2) NOT NULL,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  gateway_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  coupon_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  cashback NUMERIC(12,2) NOT NULL DEFAULT 0,
  restaurant_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  restaurant_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  gateway_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  customer_total NUMERIC(12,2) NOT NULL,
  provider TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pricing_snapshot_order ON public.order_pricing_snapshot(order_id);

GRANT SELECT ON public.order_pricing_snapshot TO authenticated;
GRANT ALL ON public.order_pricing_snapshot TO service_role;
ALTER TABLE public.order_pricing_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their restaurant snapshots"
  ON public.order_pricing_snapshot FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = order_pricing_snapshot.order_id AND r.owner_id = auth.uid()
  ));
