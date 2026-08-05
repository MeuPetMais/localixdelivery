-- Final support hardening: knowledge archive, category-scoped support access and SLA cron.

CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.support_articles
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS support_articles_public_idx
  ON public.support_articles(published, archived, position);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS sla_first_response_breached_notified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.support_sla_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  enqueued_count integer,
  ok boolean NOT NULL DEFAULT true,
  error_message text
);

GRANT SELECT ON public.support_sla_job_runs TO authenticated;
GRANT ALL ON public.support_sla_job_runs TO service_role;
ALTER TABLE public.support_sla_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support sla job admin read" ON public.support_sla_job_runs;
CREATE POLICY "support sla job admin read"
  ON public.support_sla_job_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.support_staff_allowed_categories(_user_id uuid)
RETURNS public.support_category[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(stm.allowed_categories, '{}'::public.support_category[])
    FROM public.support_team_members stm
   WHERE stm.user_id = _user_id
     AND stm.active = true
     AND stm.role::text = 'support_agent'
$$;

CREATE OR REPLACE FUNCTION public.can_access_support_category(_user_id uuid, _category public.support_category)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND role::text IN ('admin', 'support_manager')
  )
  OR EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.support_team_members stm ON stm.user_id = ur.user_id
     WHERE ur.user_id = _user_id
       AND ur.role::text = 'support_agent'
       AND stm.role = ur.role
       AND stm.active = true
       AND _category = ANY(stm.allowed_categories)
  )
$$;

GRANT EXECUTE ON FUNCTION public.support_staff_allowed_categories(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_support_category(uuid, public.support_category) TO authenticated;

DROP POLICY IF EXISTS "support tickets scoped select" ON public.support_tickets;
CREATE POLICY "support tickets scoped select"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (
    public.can_access_support_category(auth.uid(), support_tickets.category)
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
       WHERE r.id = support_tickets.restaurant_id
         AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "support tickets scoped update" ON public.support_tickets;
CREATE POLICY "support tickets scoped update"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (
    public.can_access_support_category(auth.uid(), support_tickets.category)
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
       WHERE r.id = support_tickets.restaurant_id
         AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.can_access_support_category(auth.uid(), support_tickets.category)
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
       WHERE r.id = support_tickets.restaurant_id
         AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "support messages scoped select" ON public.support_messages;
CREATE POLICY "support messages scoped select"
  ON public.support_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.support_tickets t
       WHERE t.id = support_messages.ticket_id
         AND public.can_access_support_category(auth.uid(), t.category)
    )
    OR (
      internal_note = false
      AND EXISTS (
        SELECT 1
          FROM public.support_tickets t
          JOIN public.restaurants r ON r.id = t.restaurant_id
         WHERE t.id = support_messages.ticket_id
           AND (t.user_id = auth.uid() OR r.owner_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "support messages staff insert" ON public.support_messages;
CREATE POLICY "support messages staff insert"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND author_type = 'suporte'
    AND EXISTS (
      SELECT 1
        FROM public.support_tickets t
       WHERE t.id = support_messages.ticket_id
         AND public.can_access_support_category(auth.uid(), t.category)
    )
  );

DROP POLICY IF EXISTS "support messages scoped update" ON public.support_messages;
CREATE POLICY "support messages scoped update"
  ON public.support_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.support_tickets t
       WHERE t.id = support_messages.ticket_id
         AND public.can_access_support_category(auth.uid(), t.category)
    )
    OR EXISTS (
      SELECT 1
        FROM public.support_tickets t
        JOIN public.restaurants r ON r.id = t.restaurant_id
       WHERE t.id = support_messages.ticket_id
         AND (t.user_id = auth.uid() OR r.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.support_tickets t
       WHERE t.id = support_messages.ticket_id
         AND public.can_access_support_category(auth.uid(), t.category)
    )
    OR EXISTS (
      SELECT 1
        FROM public.support_tickets t
        JOIN public.restaurants r ON r.id = t.restaurant_id
       WHERE t.id = support_messages.ticket_id
         AND (t.user_id = auth.uid() OR r.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "read published articles" ON public.support_articles;
CREATE POLICY "read published articles"
  ON public.support_articles FOR SELECT
  USING (
    (published = true AND archived = false)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_support_manager(auth.uid())
  );

DROP POLICY IF EXISTS "admins manage articles" ON public.support_articles;
CREATE POLICY "admins manage articles"
  ON public.support_articles FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_support_manager(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_support_manager(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.enqueue_support_sla_notifications(_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket record;
  enqueued integer := 0;
  near_threshold interval;
BEGIN
  SELECT make_interval(mins => COALESCE((support_sla_settings->>'near_due_threshold_minutes')::integer, 60))
    INTO near_threshold
    FROM public.platform_settings
   WHERE id = true;

  FOR ticket IN
    SELECT *
      FROM public.support_tickets
     WHERE status NOT IN ('resolvido', 'fechado')
  LOOP
    IF ticket.first_response_at IS NULL
       AND ticket.sla_first_response_notified_at IS NULL
       AND ticket.sla_due_at IS NOT NULL
       AND _now >= ticket.sla_due_at - near_threshold
       AND _now < ticket.sla_due_at THEN
      PERFORM public.notify_support_recipients('SUPPORT_SLA_NEAR_DUE', ticket.id, 'HIGH'::public.notification_priority, '{"sla_type":"first_response"}'::jsonb);
      UPDATE public.support_tickets SET sla_first_response_notified_at = _now WHERE id = ticket.id;
      enqueued := enqueued + 1;
    END IF;

    IF ticket.first_response_at IS NULL
       AND ticket.sla_first_response_breached_notified_at IS NULL
       AND ticket.sla_due_at IS NOT NULL
       AND _now >= ticket.sla_due_at THEN
      PERFORM public.notify_support_recipients('SUPPORT_SLA_BREACHED', ticket.id, 'CRITICAL'::public.notification_priority, '{"sla_type":"first_response"}'::jsonb);
      UPDATE public.support_tickets SET sla_first_response_breached_notified_at = _now WHERE id = ticket.id;
      enqueued := enqueued + 1;
    END IF;

    IF ticket.resolution_sla_due_at IS NOT NULL
       AND ticket.sla_resolution_near_notified_at IS NULL
       AND _now >= ticket.resolution_sla_due_at - near_threshold
       AND _now < ticket.resolution_sla_due_at THEN
      PERFORM public.notify_support_recipients('SUPPORT_SLA_NEAR_DUE', ticket.id, 'HIGH'::public.notification_priority, '{"sla_type":"resolution"}'::jsonb);
      UPDATE public.support_tickets SET sla_resolution_near_notified_at = _now WHERE id = ticket.id;
      enqueued := enqueued + 1;
    END IF;

    IF ticket.resolution_sla_due_at IS NOT NULL
       AND ticket.sla_resolution_breached_notified_at IS NULL
       AND _now >= ticket.resolution_sla_due_at THEN
      PERFORM public.notify_support_recipients('SUPPORT_SLA_BREACHED', ticket.id, 'CRITICAL'::public.notification_priority, '{"sla_type":"resolution"}'::jsonb);
      UPDATE public.support_tickets SET sla_resolution_breached_notified_at = _now WHERE id = ticket.id;
      enqueued := enqueued + 1;
    END IF;
  END LOOP;

  RETURN enqueued;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_support_sla_notifications_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count_enqueued integer;
BEGIN
  count_enqueued := public.enqueue_support_sla_notifications(now());
  INSERT INTO public.support_sla_job_runs(enqueued_count, ok)
  VALUES (count_enqueued, true);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.support_sla_job_runs(enqueued_count, ok, error_message)
  VALUES (NULL, false, SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.run_support_sla_notifications_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_support_sla_notifications_job() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'support-sla-notifications-every-5-minutes') THEN
    PERFORM cron.unschedule('support-sla-notifications-every-5-minutes');
  END IF;
  PERFORM cron.schedule(
    'support-sla-notifications-every-5-minutes',
    '*/5 * * * *',
    $cmd$SELECT public.run_support_sla_notifications_job();$cmd$
  );
END
$$;
