ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'stripe'
    CHECK (payment_provider IN ('stripe','mercado_pago'));