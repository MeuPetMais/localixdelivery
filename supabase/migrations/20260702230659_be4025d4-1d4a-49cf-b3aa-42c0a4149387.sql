
-- 1) payment_providers catalog
CREATE TABLE IF NOT EXISTS public.payment_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT false,
  supports_pix BOOLEAN NOT NULL DEFAULT false,
  supports_credit BOOLEAN NOT NULL DEFAULT false,
  supports_split BOOLEAN NOT NULL DEFAULT false,
  supports_refund BOOLEAN NOT NULL DEFAULT false,
  supports_subscription BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_providers TO authenticated;
GRANT ALL ON public.payment_providers TO service_role;

ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_providers read for authenticated"
  ON public.payment_providers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "payment_providers admin write"
  ON public.payment_providers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed rows
INSERT INTO public.payment_providers (provider_name, active, supports_pix, supports_credit, supports_split, supports_refund, supports_subscription)
VALUES
  ('mercado_pago', true,  true,  true,  true,  true,  true),
  ('pagarme',      false, true,  true,  true,  true,  true),
  ('asaas',        false, true,  true,  false, true,  true),
  ('stripe',       false, false, true,  true,  true,  true)
ON CONFLICT (provider_name) DO NOTHING;

-- 2) Extend platform_settings with PricingEngine columns
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS minimum_order NUMERIC(10,2) NOT NULL DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS platform_fee_until_30 NUMERIC(10,2) NOT NULL DEFAULT 0.99,
  ADD COLUMN IF NOT EXISTS platform_fee_above_30 NUMERIC(10,2) NOT NULL DEFAULT 1.49,
  ADD COLUMN IF NOT EXISTS default_gateway TEXT NOT NULL DEFAULT 'mercado_pago',
  ADD COLUMN IF NOT EXISTS gateway_enabled JSONB NOT NULL DEFAULT '{"mercado_pago": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL';
