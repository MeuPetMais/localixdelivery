
CREATE TYPE public.split_status AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','MANUAL_REVIEW');

CREATE TABLE public.payment_split (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_id TEXT,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  restaurant_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gateway_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.split_status NOT NULL DEFAULT 'PENDING',
  split_reference TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_payment_split_order ON public.payment_split(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_payment_split_restaurant ON public.payment_split(restaurant_id);
CREATE INDEX idx_payment_split_status ON public.payment_split(status);
CREATE INDEX idx_payment_split_created ON public.payment_split(created_at DESC);

GRANT SELECT ON public.payment_split TO authenticated;
GRANT ALL ON public.payment_split TO service_role;

ALTER TABLE public.payment_split ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all splits"
ON public.payment_split FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Restaurant owners view their splits"
ON public.payment_split FOR SELECT
TO authenticated
USING (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
);

CREATE TRIGGER trg_payment_split_updated_at
BEFORE UPDATE ON public.payment_split
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
