-- Gate D hardening: loyalty mutation RPCs are internal financial-like
-- operations and must not be directly executable by anon/authenticated.
--
-- The application invokes reservation/commit/rollback through server functions
-- using supabaseAdmin/service_role. Earnings and rollback also run from
-- SECURITY DEFINER trigger context, and expiration is executed by cron.

REVOKE ALL ON FUNCTION public.loyalty_apply(
  uuid, uuid, text, integer, text, text, uuid, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_apply(
  uuid, uuid, text, integer, text, text, uuid, text, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.loyalty_reserve(
  uuid, uuid, uuid, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_reserve(
  uuid, uuid, uuid, integer
) TO service_role;

REVOKE ALL ON FUNCTION public.loyalty_commit_reserve(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_commit_reserve(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.loyalty_rollback_reserve(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_rollback_reserve(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.loyalty_expire_points()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_expire_points()
  TO service_role;
