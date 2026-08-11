ALTER TABLE public.order_pricing_snapshot
  ADD COLUMN IF NOT EXISTS realized_platform_revenue NUMERIC(12,2) NOT NULL DEFAULT 0;
