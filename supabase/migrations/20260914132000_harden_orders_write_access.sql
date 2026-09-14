-- Harden direct writes to public.orders.
--
-- Runtime checkout creates orders through server-side service_role
-- (createCheckoutOrder). Public clients must not create, update, or delete
-- orders directly; status changes must go through order_apply_transition.

DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;
DROP POLICY IF EXISTS "Owners delete their orders" ON public.orders;
DROP POLICY IF EXISTS "Owners update their orders" ON public.orders;

REVOKE INSERT ON public.orders FROM anon;
REVOKE INSERT ON public.orders FROM authenticated;
REVOKE UPDATE ON public.orders FROM anon;
REVOKE UPDATE ON public.orders FROM authenticated;
REVOKE DELETE ON public.orders FROM anon;
REVOKE DELETE ON public.orders FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.order_apply_transition(uuid, text, text, text, text, uuid, jsonb)
FROM anon;

GRANT EXECUTE ON FUNCTION public.order_apply_transition(uuid, text, text, text, text, uuid, jsonb)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.order_apply_transition(uuid, text, text, text, text, uuid, jsonb)
TO service_role;
