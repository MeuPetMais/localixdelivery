-- Gate 4: isolated homologation hardening. Review on shared staging BEFORE any production promotion.
-- SEC-01: constrain role lookup to the requesting identity under PostgREST/JWT.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    (_user_id = auth.uid() OR current_user IN ('service_role','postgres'))
    AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$function$;

-- FIN-02: prevent completed customer payments without an order.
ALTER TABLE public.payments
ADD CONSTRAINT payments_completed_requires_order
CHECK (lower(btrim(status)) NOT IN ('approved','paid') OR order_id IS NOT NULL);
