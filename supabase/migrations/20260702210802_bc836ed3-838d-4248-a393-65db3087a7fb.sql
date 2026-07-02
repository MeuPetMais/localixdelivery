
-- =========================
-- mercado_pago_accounts
-- =========================
CREATE TABLE public.mercado_pago_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  mp_user_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  public_key TEXT,
  scope TEXT,
  live_mode BOOLEAN NOT NULL DEFAULT false,
  connected BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercado_pago_accounts TO authenticated;
GRANT ALL ON public.mercado_pago_accounts TO service_role;
ALTER TABLE public.mercado_pago_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own MP account"
ON public.mercado_pago_accounts FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER trg_mp_accounts_updated
BEFORE UPDATE ON public.mercado_pago_accounts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================
-- payments
-- =========================
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mercado_pago',
  external_id TEXT,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  qr_code TEXT,
  qr_code_base64 TEXT,
  ticket_url TEXT,
  payer_email TEXT,
  paid_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_restaurant ON public.payments(restaurant_id);
CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_payments_external ON public.payments(provider, external_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own payments"
ON public.payments FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Owners insert own payments"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Admins update payments"
ON public.payments FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete payments"
ON public.payments FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payments_updated
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================
-- platform_fees (singleton)
-- =========================
CREATE TABLE public.platform_fees (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  min_order NUMERIC(12,2) NOT NULL DEFAULT 20.00,
  fee_up_to_30 NUMERIC(12,2) NOT NULL DEFAULT 0.99,
  fee_above_30 NUMERIC(12,2) NOT NULL DEFAULT 1.49,
  monthly_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.platform_fees (id) VALUES (true) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.platform_fees TO authenticated;
GRANT ALL ON public.platform_fees TO service_role;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone auth reads platform fees"
ON public.platform_fees FOR SELECT
TO authenticated USING (true);
CREATE POLICY "Admins manage platform fees"
ON public.platform_fees FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- payment_logs
-- =========================
CREATE TABLE public.payment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_logs_payment ON public.payment_logs(payment_id);

GRANT SELECT, INSERT ON public.payment_logs TO authenticated;
GRANT ALL ON public.payment_logs TO service_role;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own payment logs"
ON public.payment_logs FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Owners insert payment logs"
ON public.payment_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- =========================
-- webhook_events
-- =========================
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'mercado_pago',
  event_type TEXT,
  external_id TEXT,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_events_source ON public.webhook_events(source, external_id);

GRANT ALL ON public.webhook_events TO service_role;
GRANT SELECT ON public.webhook_events TO authenticated;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read webhook events"
ON public.webhook_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
