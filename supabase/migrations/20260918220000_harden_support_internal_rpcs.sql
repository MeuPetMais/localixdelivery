-- Gate D hardening: internal support SECURITY DEFINER helpers are not
-- application RPC contracts and must not be directly executable by API roles.
--
-- Policy helper functions (has_role, can_access_support_category,
-- is_support_staff/is_support_manager) remain available because RLS policies
-- depend on them. This migration only restricts internal notification/job
-- helpers that mutate support state or expose internal recipient identifiers.

REVOKE ALL ON FUNCTION public.enqueue_support_notification(
  uuid, text, uuid, public.notification_priority, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_support_notification(
  uuid, text, uuid, public.notification_priority, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.notify_support_recipients(
  text, uuid, public.notification_priority, jsonb, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_support_recipients(
  text, uuid, public.notification_priority, jsonb, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_support_sla_notifications(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_support_sla_notifications(timestamptz)
  TO service_role;

REVOKE ALL ON FUNCTION public.run_support_sla_notifications_job()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_support_sla_notifications_job()
  TO service_role;

REVOKE ALL ON FUNCTION public.support_internal_recipient_ids(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_internal_recipient_ids(uuid)
  TO service_role;

-- queue_next_driver remains an authenticated RPC, but direct calls must enforce
-- the same ownership rule as the server function. service_role may bypass this
-- check for orchestrators.
CREATE OR REPLACE FUNCTION public.queue_next_driver(_restaurant_id uuid)
RETURNS TABLE(queue_id uuid, driver_id uuid, queue_position integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = _restaurant_id
        AND (
          r.owner_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    ) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  RETURN QUERY
  SELECT q.id, q.driver_id, q.position
  FROM public.delivery_queue q
  WHERE q.restaurant_id = _restaurant_id
    AND q.status = 'AGUARDANDO'
  ORDER BY q.position ASC
  LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.queue_next_driver(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_next_driver(uuid)
  TO authenticated, service_role;
