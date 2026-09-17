REVOKE EXECUTE ON FUNCTION public.expire_pending_payment_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_pending_payment_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_pending_payment_orders() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_pending_payment_orders() FROM service_role;
