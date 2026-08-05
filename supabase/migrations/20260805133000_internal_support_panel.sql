-- Internal Localix support panel.
-- Keeps the legacy Portuguese enum values and maps canonical product states in application code.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_agent';

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'merchant',
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS internal_note boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.support_ticket_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_admin_queue_idx
  ON public.support_tickets(status, priority, last_message_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_assignee_idx
  ON public.support_tickets(assigned_to, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_sla_idx
  ON public.support_tickets(sla_due_at)
  WHERE sla_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_ticket_audit_ticket_idx
  ON public.support_ticket_audit(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_messages_internal_note_idx
  ON public.support_messages(ticket_id, internal_note, created_at);

GRANT SELECT ON public.support_ticket_audit TO authenticated;
GRANT ALL ON public.support_ticket_audit TO service_role;

ALTER TABLE public.support_ticket_audit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_support_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = _user_id
       AND role::text IN ('admin', 'support_manager', 'support_agent')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_support_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = _user_id
       AND role::text IN ('admin', 'support_manager')
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_support_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_support_manager(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_support_ticket_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sla_due_at IS NULL THEN
    NEW.sla_due_at := NEW.created_at + CASE NEW.priority
      WHEN 'urgente' THEN interval '1 hour'
      WHEN 'alta' THEN interval '4 hours'
      WHEN 'media' THEN interval '12 hours'
      ELSE interval '24 hours'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_defaults ON public.support_tickets;
CREATE TRIGGER support_tickets_defaults
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_ticket_defaults();

CREATE OR REPLACE FUNCTION public.tg_support_ticket_admin_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    NEW.assigned_at := CASE WHEN NEW.assigned_to IS NULL THEN NULL ELSE now() END;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'resolvido' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    ELSIF OLD.status = 'resolvido' AND NEW.status <> 'resolvido' THEN
      NEW.resolved_at := NULL;
    END IF;

    IF NEW.status = 'fechado' AND NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    ELSIF OLD.status = 'fechado' AND NEW.status <> 'fechado' THEN
      NEW.closed_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_admin_timestamps ON public.support_tickets;
CREATE TRIGGER support_tickets_admin_timestamps
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_ticket_admin_timestamps();

CREATE OR REPLACE FUNCTION public.tg_support_ticket_customer_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.is_support_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
    OR NEW.first_response_at IS DISTINCT FROM OLD.first_response_at
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.origin IS DISTINCT FROM OLD.origin
    OR NEW.sla_due_at IS DISTINCT FROM OLD.sla_due_at
    OR NEW.tags IS DISTINCT FROM OLD.tags THEN
    RAISE EXCEPTION 'Forbidden support ticket administrative update';
  END IF;

  IF NEW.status NOT IN ('resolvido', 'aberto', 'em_analise') THEN
    RAISE EXCEPTION 'Forbidden support ticket status update';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_a_customer_guard ON public.support_tickets;
CREATE TRIGGER support_tickets_a_customer_guard
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_ticket_customer_guard();

CREATE OR REPLACE FUNCTION public.tg_support_message_bump()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.internal_note THEN
    UPDATE public.support_tickets
       SET last_message_at = NEW.created_at,
           updated_at = now()
     WHERE id = NEW.ticket_id;
    RETURN NEW;
  END IF;

  UPDATE public.support_tickets
     SET last_message_at = NEW.created_at,
         updated_at = now(),
         first_response_at = CASE
           WHEN NEW.author_type = 'suporte' AND first_response_at IS NULL THEN NEW.created_at
           ELSE first_response_at
         END,
         status = CASE
           WHEN NEW.author_type = 'suporte' AND status IN ('aberto', 'em_analise') THEN 'respondido'::public.support_status
           WHEN NEW.author_type = 'cliente' AND status = 'respondido' THEN 'em_analise'::public.support_status
           ELSE status
         END
   WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "owners read own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "owners create own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "owners update own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "admins delete tickets" ON public.support_tickets;

CREATE POLICY "support tickets scoped select"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (
    public.is_support_staff(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
       WHERE r.id = support_tickets.restaurant_id
         AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "support tickets merchant insert"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
       WHERE r.id = support_tickets.restaurant_id
         AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "support tickets scoped update"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (
    public.is_support_staff(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
       WHERE r.id = support_tickets.restaurant_id
         AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_support_staff(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
       WHERE r.id = support_tickets.restaurant_id
         AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "support tickets admin delete"
  ON public.support_tickets FOR DELETE TO authenticated
  USING (public.is_support_manager(auth.uid()));

DROP POLICY IF EXISTS "read ticket messages" ON public.support_messages;
DROP POLICY IF EXISTS "insert ticket messages" ON public.support_messages;
DROP POLICY IF EXISTS "mark messages read" ON public.support_messages;

CREATE POLICY "support messages scoped select"
  ON public.support_messages FOR SELECT TO authenticated
  USING (
    public.is_support_staff(auth.uid())
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

CREATE POLICY "support messages merchant insert"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND author_type = 'cliente'
    AND internal_note = false
    AND EXISTS (
      SELECT 1
        FROM public.support_tickets t
        JOIN public.restaurants r ON r.id = t.restaurant_id
       WHERE t.id = support_messages.ticket_id
         AND (t.user_id = auth.uid() OR r.owner_id = auth.uid())
    )
  );

CREATE POLICY "support messages staff insert"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND author_type = 'suporte'
    AND public.is_support_staff(auth.uid())
  );

CREATE POLICY "support messages scoped update"
  ON public.support_messages FOR UPDATE TO authenticated
  USING (
    public.is_support_staff(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.support_tickets t
        JOIN public.restaurants r ON r.id = t.restaurant_id
       WHERE t.id = support_messages.ticket_id
         AND (t.user_id = auth.uid() OR r.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_support_staff(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.support_tickets t
        JOIN public.restaurants r ON r.id = t.restaurant_id
       WHERE t.id = support_messages.ticket_id
         AND (t.user_id = auth.uid() OR r.owner_id = auth.uid())
    )
  );

CREATE POLICY "support audit staff read"
  ON public.support_ticket_audit FOR SELECT TO authenticated
  USING (public.is_support_staff(auth.uid()));
