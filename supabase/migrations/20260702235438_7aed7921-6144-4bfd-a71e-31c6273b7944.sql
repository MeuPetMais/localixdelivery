
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
CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_provider_eventid_uk
  ON public.payment_webhook_events (provider, event_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_webhook_events_resource_idx
  ON public.payment_webhook_events (provider, resource_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_extref_idx
  ON public.payment_webhook_events (external_reference);
CREATE INDEX IF NOT EXISTS payment_webhook_events_processed_idx
  ON public.payment_webhook_events (processed, created_at DESC);

GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read webhook events"
  ON public.payment_webhook_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payment_webhook_events_updated_at
  BEFORE UPDATE ON public.payment_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

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
CREATE INDEX IF NOT EXISTS payment_event_queue_status_idx
  ON public.payment_event_queue (status, next_retry);

GRANT SELECT ON public.payment_event_queue TO authenticated;
GRANT ALL ON public.payment_event_queue TO service_role;
ALTER TABLE public.payment_event_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read event queue"
  ON public.payment_event_queue FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payment_event_queue_updated_at
  BEFORE UPDATE ON public.payment_event_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
