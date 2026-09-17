REVOKE ALL PRIVILEGES ON TABLE public.payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payments TO anon, authenticated;

DROP POLICY IF EXISTS "Owners insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins update payments" ON public.payments;
DROP POLICY IF EXISTS "Admins delete payments" ON public.payments;
