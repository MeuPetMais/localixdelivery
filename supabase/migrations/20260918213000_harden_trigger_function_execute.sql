-- Gate D hardening: trigger-only SECURITY DEFINER functions must not be
-- directly executable by API roles.
--
-- These functions are attached to database triggers and are not application
-- RPC contracts. Revoking direct EXECUTE does not disable trigger execution.

REVOKE ALL ON FUNCTION public.enforce_driver_earning_from_order_snapshot()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.enforce_partner_email_only()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.enforce_role_email_only()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tg_link_reused_driver_identity()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tg_orders_loyalty_status()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tg_reuse_existing_driver_identity()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tg_support_message_notifications()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tg_support_ticket_admin_timestamps()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tg_support_ticket_defaults()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tg_support_ticket_notifications()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tg_support_ticket_reopen_counter()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tg_sync_driver_restaurant_membership()
  FROM PUBLIC, anon, authenticated;

-- queue_next_driver is intentionally an authenticated read RPC; anon access was
-- an accidental default grant.
REVOKE ALL ON FUNCTION public.queue_next_driver(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_next_driver(uuid)
  TO authenticated, service_role;
