-- Controlled administrative support operations.
-- Service-role callers must pass the already authenticated app user as _actor_user_id.

CREATE OR REPLACE FUNCTION public.support_admin_actor_role(_actor_user_id uuid)
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
  _member record;
BEGIN
  SELECT ur.role
    INTO _role
    FROM public.user_roles ur
   WHERE ur.user_id = _actor_user_id
     AND ur.role::text IN ('admin', 'support_manager', 'support_agent')
   ORDER BY CASE ur.role::text
      WHEN 'admin' THEN 1
      WHEN 'support_manager' THEN 2
      ELSE 3
   END
   LIMIT 1;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _role::text <> 'admin' THEN
    SELECT stm.role, stm.active
      INTO _member
      FROM public.support_team_members stm
     WHERE stm.user_id = _actor_user_id;

    IF NOT FOUND OR _member.active IS DISTINCT FROM true OR _member.role IS DISTINCT FROM _role THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  RETURN _role;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_admin_can_access_ticket_category(
  _actor_user_id uuid,
  _actor_role public.app_role,
  _category public.support_category
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _actor_role::text IN ('admin', 'support_manager') THEN true
    ELSE EXISTS (
      SELECT 1
        FROM public.support_team_members stm
       WHERE stm.user_id = _actor_user_id
         AND stm.role = _actor_role
         AND stm.active = true
         AND _category = ANY(stm.allowed_categories)
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.support_admin_assert_permission(
  _actor_user_id uuid,
  _action text,
  _category public.support_category,
  _assigned_to uuid DEFAULT NULL
)
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  _role := public.support_admin_actor_role(_actor_user_id);

  IF NOT public.support_admin_can_access_ticket_category(_actor_user_id, _role, _category) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _role::text = 'support_agent' AND _action NOT IN ('take', 'waiting_customer', 'resolve', 'reply', 'internal_note') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _role::text = 'support_manager' AND _action = 'close' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _action = 'resolve'
     AND _role::text = 'support_agent'
     AND _assigned_to IS DISTINCT FROM _actor_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN _role;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_admin_context_is_valid()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_setting text;
  _actor_user_id uuid;
BEGIN
  _actor_setting := current_setting('localix.support_admin_actor', true);
  IF _actor_setting IS NULL OR _actor_setting = '' THEN
    RETURN false;
  END IF;

  BEGIN
    _actor_user_id := _actor_setting::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  PERFORM public.support_admin_actor_role(_actor_user_id);
  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_support_ticket_customer_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.is_support_staff(auth.uid()) OR public.support_admin_context_is_valid() THEN
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

CREATE OR REPLACE FUNCTION public.support_admin_take_ticket(
  _actor_user_id uuid,
  _ticket_id uuid
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before public.support_tickets%ROWTYPE;
  _after public.support_tickets%ROWTYPE;
  _role public.app_role;
BEGIN
  SELECT * INTO _before
    FROM public.support_tickets
   WHERE id = _ticket_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  _role := public.support_admin_assert_permission(_actor_user_id, 'take', _before.category, _before.assigned_to);
  PERFORM set_config('localix.support_admin_actor', _actor_user_id::text, true);

  UPDATE public.support_tickets
     SET assigned_to = _actor_user_id,
         status = 'em_analise'::public.support_status
   WHERE id = _ticket_id
   RETURNING * INTO _after;

  INSERT INTO public.support_ticket_audit(ticket_id, actor_id, actor_role, action, before, after)
  VALUES (_ticket_id, _actor_user_id, _role::text, 'ticket.taken', to_jsonb(_before), to_jsonb(_after));

  RETURN _after;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_admin_assign_ticket(
  _actor_user_id uuid,
  _ticket_id uuid,
  _assignee_id uuid DEFAULT NULL
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before public.support_tickets%ROWTYPE;
  _after public.support_tickets%ROWTYPE;
  _role public.app_role;
  _target record;
BEGIN
  SELECT * INTO _before
    FROM public.support_tickets
   WHERE id = _ticket_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  _role := public.support_admin_assert_permission(_actor_user_id, 'assign', _before.category, _before.assigned_to);

  IF _assignee_id IS NOT NULL THEN
    SELECT stm.role, stm.active, stm.allowed_categories
      INTO _target
      FROM public.support_team_members stm
     WHERE stm.user_id = _assignee_id;

    IF NOT FOUND OR _target.active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Assignee is inactive';
    END IF;

    IF _target.role::text = 'support_agent' AND NOT (_before.category = ANY(_target.allowed_categories)) THEN
      RAISE EXCEPTION 'Assignee cannot access ticket category';
    END IF;
  END IF;

  PERFORM set_config('localix.support_admin_actor', _actor_user_id::text, true);

  UPDATE public.support_tickets
     SET assigned_to = _assignee_id,
         status = CASE WHEN _assignee_id IS NULL THEN status ELSE 'em_analise'::public.support_status END
   WHERE id = _ticket_id
   RETURNING * INTO _after;

  INSERT INTO public.support_ticket_audit(ticket_id, actor_id, actor_role, action, before, after)
  VALUES (_ticket_id, _actor_user_id, _role::text, 'ticket.assigned', to_jsonb(_before), to_jsonb(_after));

  RETURN _after;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_admin_update_status(
  _actor_user_id uuid,
  _ticket_id uuid,
  _status public.support_status
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before public.support_tickets%ROWTYPE;
  _after public.support_tickets%ROWTYPE;
  _role public.app_role;
  _action text;
BEGIN
  SELECT * INTO _before
    FROM public.support_tickets
   WHERE id = _ticket_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  _action := CASE
    WHEN _status = 'respondido' THEN 'waiting_customer'
    WHEN _status = 'em_analise' THEN 'waiting_support'
    WHEN _status = 'resolvido' THEN 'resolve'
    WHEN _status = 'fechado' THEN 'close'
    ELSE 'reopen'
  END;

  _role := public.support_admin_assert_permission(_actor_user_id, _action, _before.category, _before.assigned_to);
  PERFORM set_config('localix.support_admin_actor', _actor_user_id::text, true);

  UPDATE public.support_tickets
     SET status = _status
   WHERE id = _ticket_id
   RETURNING * INTO _after;

  INSERT INTO public.support_ticket_audit(ticket_id, actor_id, actor_role, action, before, after)
  VALUES (_ticket_id, _actor_user_id, _role::text, 'ticket.status.' || _status::text, to_jsonb(_before), to_jsonb(_after));

  RETURN _after;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_admin_update_meta(
  _actor_user_id uuid,
  _ticket_id uuid,
  _priority public.support_priority DEFAULT NULL,
  _category public.support_category DEFAULT NULL,
  _tags text[] DEFAULT NULL
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before public.support_tickets%ROWTYPE;
  _after public.support_tickets%ROWTYPE;
  _role public.app_role;
BEGIN
  SELECT * INTO _before
    FROM public.support_tickets
   WHERE id = _ticket_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  IF _priority IS NOT NULL THEN
    _role := public.support_admin_assert_permission(_actor_user_id, 'change_priority', _before.category, _before.assigned_to);
  ELSIF _category IS NOT NULL THEN
    _role := public.support_admin_assert_permission(_actor_user_id, 'change_category', _before.category, _before.assigned_to);
  ELSE
    _role := public.support_admin_assert_permission(_actor_user_id, 'change_priority', _before.category, _before.assigned_to);
  END IF;

  IF _category IS NOT NULL AND _role::text = 'support_agent' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM set_config('localix.support_admin_actor', _actor_user_id::text, true);

  UPDATE public.support_tickets
     SET priority = COALESCE(_priority, priority),
         category = COALESCE(_category, category),
         tags = COALESCE(_tags, tags)
   WHERE id = _ticket_id
   RETURNING * INTO _after;

  INSERT INTO public.support_ticket_audit(ticket_id, actor_id, actor_role, action, before, after)
  VALUES (_ticket_id, _actor_user_id, _role::text, 'ticket.meta_changed', to_jsonb(_before), to_jsonb(_after));

  RETURN _after;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_admin_prepare_reply(
  _actor_user_id uuid,
  _ticket_id uuid,
  _body text,
  _internal_note boolean DEFAULT false
)
RETURNS public.support_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ticket_before public.support_tickets%ROWTYPE;
  _ticket_after public.support_tickets%ROWTYPE;
  _message public.support_messages%ROWTYPE;
  _role public.app_role;
  _action text;
BEGIN
  SELECT * INTO _ticket_before
    FROM public.support_tickets
   WHERE id = _ticket_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  _action := CASE WHEN _internal_note THEN 'internal_note' ELSE 'reply' END;
  _role := public.support_admin_assert_permission(_actor_user_id, _action, _ticket_before.category, _ticket_before.assigned_to);

  IF length(btrim(COALESCE(_body, ''))) = 0 OR length(_body) > 10000 THEN
    RAISE EXCEPTION 'Invalid support message body';
  END IF;

  PERFORM set_config('localix.support_admin_actor', _actor_user_id::text, true);

  IF _ticket_before.assigned_to IS NULL THEN
    UPDATE public.support_tickets
       SET assigned_to = _actor_user_id
     WHERE id = _ticket_id
     RETURNING * INTO _ticket_after;

    INSERT INTO public.support_ticket_audit(ticket_id, actor_id, actor_role, action, before, after)
    VALUES (_ticket_id, _actor_user_id, _role::text, 'ticket.auto_assigned', to_jsonb(_ticket_before), to_jsonb(_ticket_after));
  END IF;

  INSERT INTO public.support_messages(ticket_id, author_id, author_type, body, internal_note)
  VALUES (_ticket_id, _actor_user_id, 'suporte', _body, COALESCE(_internal_note, false))
  RETURNING * INTO _message;

  UPDATE public.support_team_members
     SET last_activity_at = now()
   WHERE user_id = _actor_user_id;

  INSERT INTO public.support_ticket_audit(ticket_id, actor_id, actor_role, action, after)
  VALUES (_ticket_id, _actor_user_id, _role::text, CASE WHEN _internal_note THEN 'ticket.internal_note.created' ELSE 'ticket.replied' END, to_jsonb(_message));

  RETURN _message;
END;
$$;

REVOKE ALL ON FUNCTION public.support_admin_actor_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_admin_can_access_ticket_category(uuid, public.app_role, public.support_category) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_admin_assert_permission(uuid, text, public.support_category, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_admin_context_is_valid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_admin_take_ticket(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_admin_assign_ticket(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_admin_update_status(uuid, uuid, public.support_status) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_admin_update_meta(uuid, uuid, public.support_priority, public.support_category, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_admin_prepare_reply(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.support_admin_take_ticket(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_admin_assign_ticket(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_admin_update_status(uuid, uuid, public.support_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_admin_update_meta(uuid, uuid, public.support_priority, public.support_category, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_admin_prepare_reply(uuid, uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_admin_context_is_valid() TO authenticated, service_role;
