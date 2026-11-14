-- Gate 4 OAuth: isolated homologation dependency parity (Staging catalog 2026-11-14).
-- No effect on Production or shared Staging.
CREATE TABLE public.oauth_states (
  state text NOT NULL PRIMARY KEY,
  provider text NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code_verifier text NOT NULL,
  redirect_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at timestamptz
);
CREATE INDEX oauth_states_restaurant_idx ON public.oauth_states(restaurant_id);
CREATE INDEX oauth_states_expires_idx ON public.oauth_states(expires_at);
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oauth_states FROM PUBLIC, anon, authenticated;

CREATE TABLE public.payment_logs (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_logs_payment ON public.payment_logs(payment_id);
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_logs FROM PUBLIC, anon, authenticated;
CREATE POLICY "Owners insert payment logs" ON public.payment_logs FOR INSERT TO authenticated
WITH CHECK (
  EXISTS(SELECT 1 FROM public.restaurants r WHERE r.id=payment_logs.restaurant_id AND r.owner_id=auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
CREATE POLICY "Owners view own payment logs" ON public.payment_logs FOR SELECT TO authenticated
USING (
  EXISTS(SELECT 1 FROM public.restaurants r WHERE r.id=payment_logs.restaurant_id AND r.owner_id=auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
GRANT SELECT, INSERT ON public.payment_logs TO authenticated;
