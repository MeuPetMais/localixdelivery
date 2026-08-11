ALTER TABLE public.tenant_payment_settings
  ADD COLUMN IF NOT EXISTS service_fee_payer TEXT NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS service_fee_last_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_fee_change_locked_until TIMESTAMPTZ;

ALTER TABLE public.tenant_payment_settings
  DROP CONSTRAINT IF EXISTS tenant_payment_settings_service_fee_payer_check;

ALTER TABLE public.tenant_payment_settings
  ADD CONSTRAINT tenant_payment_settings_service_fee_payer_check
  CHECK (service_fee_payer IN ('customer', 'restaurant'));

INSERT INTO public.tenant_payment_settings (
  restaurant_id,
  delivery_fee,
  minimum_order,
  service_fee_payer
)
SELECT
  r.id,
  COALESCE(r.delivery_fee, 0),
  COALESCE(r.min_order, 0),
  'customer'
FROM public.restaurants r
ON CONFLICT (restaurant_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tenant_payment_settings_service_fee_lock
  ON public.tenant_payment_settings (restaurant_id, service_fee_change_locked_until);

ALTER TABLE public.order_pricing_snapshot
  ADD COLUMN IF NOT EXISTS service_fee_payer TEXT NOT NULL DEFAULT 'customer';

ALTER TABLE public.order_pricing_snapshot
  DROP CONSTRAINT IF EXISTS order_pricing_snapshot_service_fee_payer_check;

ALTER TABLE public.order_pricing_snapshot
  ADD CONSTRAINT order_pricing_snapshot_service_fee_payer_check
  CHECK (service_fee_payer IN ('customer', 'restaurant'));
