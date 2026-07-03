
CREATE TYPE public.reconciliation_status AS ENUM ('PENDING','MATCHED','DIVERGENT','FAILED','MANUAL_REVIEW');

CREATE TABLE public.payment_reconciliation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_id TEXT,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  external_reference TEXT,
  gateway_gross_amount NUMERIC(12,2),
  gateway_fee NUMERIC(12,2),
  platform_fee NUMERIC(12,2),
  restaurant_amount NUMERIC(12,2),
  localix_amount NUMERIC(12,2),
  expected_total NUMERIC(12,2),
  received_total NUMERIC(12,2),
  difference_amount NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'BRL',
  status public.reconciliation_status NOT NULL DEFAULT 'PENDING',
  reconciled BOOLEAN NOT NULL DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pay_recon_order ON public.payment_reconciliation(order_id);
CREATE INDEX idx_pay_recon_payment ON public.payment_reconciliation(payment_id);
CREATE INDEX idx_pay_recon_status ON public.payment_reconciliation(status);
CREATE INDEX idx_pay_recon_created ON public.payment_reconciliation(created_at DESC);

GRANT SELECT ON public.payment_reconciliation TO authenticated;
GRANT ALL ON public.payment_reconciliation TO service_role;

ALTER TABLE public.payment_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reconciliation"
ON public.payment_reconciliation FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payment_reconciliation_updated_at
BEFORE UPDATE ON public.payment_reconciliation
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
