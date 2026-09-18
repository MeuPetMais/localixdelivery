-- Gate D hardening: align critical financial/benefit table grants with RLS.
--
-- These tables only expose SELECT policies to authenticated users. Broad
-- INSERT/UPDATE/DELETE/REFERENCES/TRIGGER grants came from schema defaults and
-- provide no legitimate application capability because RLS has no write
-- policies. Keep authenticated SELECT where policies exist; remove anon access
-- and unnecessary authenticated write/DDL-adjacent privileges.
--
-- Also stop future SECURITY DEFINER/public functions from inheriting EXECUTE
-- for API roles by default. New RPCs must grant EXECUTE explicitly.

REVOKE ALL ON TABLE public.financial_ledger FROM anon;
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
  ON TABLE public.financial_ledger FROM authenticated;

REVOKE ALL ON TABLE public.order_payment FROM anon;
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
  ON TABLE public.order_payment FROM authenticated;

REVOKE ALL ON TABLE public.order_pricing_snapshot FROM anon;
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
  ON TABLE public.order_pricing_snapshot FROM authenticated;

REVOKE ALL ON TABLE public.payment_reconciliation FROM anon;
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
  ON TABLE public.payment_reconciliation FROM authenticated;

REVOKE ALL ON TABLE public.payment_split FROM anon;
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
  ON TABLE public.payment_split FROM authenticated;

REVOKE ALL ON TABLE public.payment_webhook_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
  ON TABLE public.payment_webhook_events FROM authenticated;

REVOKE ALL ON TABLE public.customer_loyalty FROM anon;
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
  ON TABLE public.customer_loyalty FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
