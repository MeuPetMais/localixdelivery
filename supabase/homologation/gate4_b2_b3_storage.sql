-- Gate4 H2/H3: FINANCIAL STORAGE ONLY, no MP credentials, no webhook/cron.
-- Apply ONLY to gvozcqyjhogmvebrwzap; not full E2E homologation.
CREATE TYPE public.ledger_transaction_type AS ENUM ('ORDER_CREATED','PAYMENT_PENDING','PAYMENT_APPROVED','PAYMENT_FAILED','PLATFORM_FEE','GATEWAY_FEE','RESTAURANT_RECEIVABLE','REFUND','CHARGEBACK','PAYOUT','ADJUSTMENT');
CREATE TYPE public.ledger_status AS ENUM ('PENDING','COMPLETED','FAILED','CANCELLED');
CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC,anon,authenticated;

-- Source: 20260702210802_bc836ed3-838d-4248-a393-65db3087a7fb.sql, mercado_pago_accounts
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

-- Source: 20260702210802_bc836ed3-838d-4248-a393-65db3087a7fb.sql, payments
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

-- Source: 20260702232241_87b123ce-fae1-4f95-9b3a-b4652e3524d5.sql, order_payment
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

-- Source: 20260702232241_87b123ce-fae1-4f95-9b3a-b4652e3524d5.sql, order_pricing_snapshot
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

-- Source: 20260702232952_2822826e-0fbe-4ffc-a4e4-56badba019fd.sql, financial_ledger
CREATE TABLE public.financial_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  restaurant_id UUID NULL REFERENCES public.restaurants(id) ON DELETE SET NULL,
  customer_id UUID NULL,
  provider TEXT NULL,
  transaction_type public.ledger_transaction_type NOT NULL,
  reference_type TEXT NULL,
  reference_id TEXT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status public.ledger_status NOT NULL DEFAULT 'PENDING',
  description TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Source: 20260702235438_7aed7921-6144-4bfd-a71e-31c6273b7944.sql, payment_webhook_events
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'mercado_pago',
  event_id TEXT,
  event_type TEXT,
  action TEXT,
  resource_id TEXT,
  external_reference TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_attempts INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Source: 20260702235438_7aed7921-6144-4bfd-a71e-31c6273b7944.sql, payment_event_queue
CREATE TABLE IF NOT EXISTS public.payment_event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.payment_webhook_events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  next_retry TIMESTAMPTZ,
  locked BOOLEAN NOT NULL DEFAULT false,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_pricing_snapshot ADD COLUMN loyalty_discount numeric NOT NULL DEFAULT 0, ADD COLUMN service_fee_payer text NOT NULL DEFAULT 'customer', ADD COLUMN realized_platform_revenue numeric NOT NULL DEFAULT 0, ADD CONSTRAINT order_pricing_snapshot_service_fee_payer_check CHECK (service_fee_payer IN ('customer','restaurant'));
ALTER TABLE public.order_payment ADD COLUMN transaction_amount numeric, ADD COLUMN expiration_date timestamptz, ADD COLUMN qr_code text, ADD COLUMN qr_code_base64 text, ADD COLUMN payment_url text, ADD COLUMN last_error text;
ALTER TABLE public.order_payment ADD CONSTRAINT order_payment_order_id_key UNIQUE(order_id);
ALTER TABLE public.payments ADD CONSTRAINT payments_provider_external_uk UNIQUE(provider,external_id);

REVOKE ALL ON public.mercado_pago_accounts,public.payments,public.order_payment,public.order_pricing_snapshot,public.financial_ledger,public.payment_webhook_events,public.payment_event_queue FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.mercado_pago_accounts,public.payments,public.order_payment,public.order_pricing_snapshot,public.financial_ledger,public.payment_webhook_events,public.payment_event_queue TO service_role;
GRANT SELECT ON public.payments,public.order_payment,public.order_pricing_snapshot,public.financial_ledger,public.payment_webhook_events,public.payment_event_queue TO authenticated;
ALTER TABLE public.mercado_pago_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_pricing_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_event_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own payments" ON public.payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=payments.restaurant_id AND r.owner_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners view their restaurant payments" ON public.order_payment FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=order_payment.restaurant_id AND r.owner_id=auth.uid()));
CREATE POLICY "Owners view their restaurant snapshots" ON public.order_pricing_snapshot FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.restaurants r ON r.id=o.restaurant_id WHERE o.id=order_pricing_snapshot.order_id AND r.owner_id=auth.uid()));
CREATE POLICY "Restaurant owners read own ledger" ON public.financial_ledger FOR SELECT TO authenticated USING (restaurant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=financial_ledger.restaurant_id AND r.owner_id=auth.uid()));
CREATE POLICY "Admins read all ledger" ON public.financial_ledger FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read webhook events" ON public.payment_webhook_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read event queue" ON public.payment_event_queue FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE UNIQUE INDEX financial_ledger_mp_idempotency_uidx ON public.financial_ledger(provider,reference_type,reference_id,transaction_type) WHERE provider='mercado_pago' AND reference_type IS NOT NULL AND reference_id IS NOT NULL AND metadata ? 'ledger_idempotency_key' AND transaction_type IN ('PAYMENT_PENDING','PAYMENT_APPROVED','PAYMENT_FAILED','REFUND','CHARGEBACK');
CREATE UNIQUE INDEX financial_ledger_mp_payment_type_idempotency_uk ON public.financial_ledger((metadata ->> 'ledger_idempotency_key')) WHERE provider='mercado_pago' AND reference_type='mp_payment' AND metadata ? 'ledger_idempotency_key' AND transaction_type IN ('PAYMENT_PENDING','PAYMENT_APPROVED','PAYMENT_FAILED');
CREATE UNIQUE INDEX payment_webhook_events_provider_eventid_uk ON public.payment_webhook_events(provider,event_id) WHERE event_id IS NOT NULL;
CREATE INDEX payment_event_queue_status_idx ON public.payment_event_queue(status,next_retry);
CREATE INDEX idx_fin_ledger_restaurant ON public.financial_ledger(restaurant_id,created_at DESC);
CREATE TRIGGER trg_mp_accounts_updated BEFORE UPDATE ON public.mercado_pago_accounts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_order_payment_updated_at BEFORE UPDATE ON public.order_payment FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_fin_ledger_updated_at BEFORE UPDATE ON public.financial_ledger FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_payment_webhook_events_updated_at BEFORE UPDATE ON public.payment_webhook_events FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_payment_event_queue_updated_at BEFORE UPDATE ON public.payment_event_queue FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
