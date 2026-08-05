-- Support operations: notifications, SLA settings, quick replies and reporting helpers.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS support_timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS support_sla_settings jsonb NOT NULL DEFAULT
    '{
      "timezone": "America/Sao_Paulo",
      "pause_when_waiting_customer": true,
      "near_due_threshold_minutes": 60,
      "priorities": {
        "baixa": { "first_response_minutes": 1440, "resolution_minutes": 4320 },
        "media": { "first_response_minutes": 720, "resolution_minutes": 1440 },
        "alta": { "first_response_minutes": 240, "resolution_minutes": 480 },
        "urgente": { "first_response_minutes": 60, "resolution_minutes": 240 }
      }
    }'::jsonb;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resolution_sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_first_response_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolution_near_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolution_breached_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS support_tickets_resolution_sla_idx
  ON public.support_tickets(resolution_sla_due_at)
  WHERE resolution_sla_due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  category public.support_category,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body !~* '<[^>]+>')
);

CREATE INDEX IF NOT EXISTS support_quick_replies_active_idx
  ON public.support_quick_replies(active, category, position);

GRANT SELECT ON public.support_quick_replies TO authenticated;
GRANT ALL ON public.support_quick_replies TO service_role;

ALTER TABLE public.support_quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support quick replies staff read" ON public.support_quick_replies;
CREATE POLICY "support quick replies staff read"
  ON public.support_quick_replies FOR SELECT TO authenticated
  USING (public.is_support_staff(auth.uid()) AND active = true);

DROP POLICY IF EXISTS "support quick replies admin manage" ON public.support_quick_replies;
CREATE POLICY "support quick replies admin manage"
  ON public.support_quick_replies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS support_quick_replies_updated ON public.support_quick_replies;
CREATE TRIGGER support_quick_replies_updated
  BEFORE UPDATE ON public.support_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.support_quick_replies (code, title, body, category, position)
VALUES
  ('analisando', 'Estamos analisando', 'Ola {{restaurant_name}}, estamos analisando o chamado #{{ticket_number}} e retornaremos em breve. - {{agent_name}}', NULL, 10),
  ('mais_informacoes', 'Precisamos de mais informacoes', 'Ola {{restaurant_name}}, para avancarmos no chamado #{{ticket_number}}, envie mais detalhes ou prints do ocorrido. - {{agent_name}}', NULL, 20),
  ('problema_resolvido', 'Problema resolvido', 'Ola {{restaurant_name}}, o chamado #{{ticket_number}} foi resolvido. Pode validar por favor? - {{agent_name}}', NULL, 30),
  ('orientacao_pedidos', 'Orientacao sobre pedidos', 'Verifique a tela de Pedidos e atualize o status do pedido. Se continuar falhando, envie o numero do pedido no chamado #{{ticket_number}}.', 'pedido', 40),
  ('orientacao_pagamento', 'Orientacao sobre pagamento', 'Para pagamentos, confirme o status em Financeiro e envie o identificador da transacao no chamado #{{ticket_number}}.', 'pagamentos', 50),
  ('orientacao_impressora', 'Orientacao sobre impressora', 'Confira se a impressora esta ligada, com papel e conectada. Depois faca um teste em Configuracoes de Impressao e nos avise no chamado #{{ticket_number}}.', 'impressao', 60)
ON CONFLICT (code) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    category = EXCLUDED.category,
    active = true,
    position = EXCLUDED.position;

INSERT INTO public.notification_templates (code, name, channel, language, subject, title, body, variables_json)
VALUES
  ('SUPPORT_TICKET_CREATED', 'Novo chamado de suporte', 'IN_APP', 'pt-BR', NULL, 'Novo chamado', '#{{ticket_number}} - {{subject}} foi aberto por {{restaurant_name}}.', '["ticket_number","subject","restaurant_name","priority"]'),
  ('SUPPORT_TICKET_URGENT', 'Chamado urgente', 'IN_APP', 'pt-BR', NULL, 'Chamado urgente', '#{{ticket_number}} - {{subject}} foi marcado como urgente.', '["ticket_number","subject","restaurant_name"]'),
  ('SUPPORT_MESSAGE_FROM_MERCHANT', 'Nova mensagem do estabelecimento', 'IN_APP', 'pt-BR', NULL, 'Nova mensagem', '{{restaurant_name}} enviou mensagem no chamado #{{ticket_number}}.', '["ticket_number","restaurant_name","subject"]'),
  ('SUPPORT_TICKET_ASSIGNED', 'Chamado atribuido', 'IN_APP', 'pt-BR', NULL, 'Chamado atribuido', 'O chamado #{{ticket_number}} foi atribuido a voce.', '["ticket_number","subject","restaurant_name"]'),
  ('SUPPORT_TICKET_TRANSFERRED', 'Chamado transferido', 'IN_APP', 'pt-BR', NULL, 'Chamado transferido', 'O chamado #{{ticket_number}} foi transferido para voce.', '["ticket_number","subject","restaurant_name"]'),
  ('SUPPORT_SLA_NEAR_DUE', 'SLA proximo do vencimento', 'IN_APP', 'pt-BR', NULL, 'SLA proximo', 'O SLA do chamado #{{ticket_number}} vence em breve.', '["ticket_number","subject","restaurant_name","sla_type"]'),
  ('SUPPORT_SLA_BREACHED', 'SLA vencido', 'IN_APP', 'pt-BR', NULL, 'SLA vencido', 'O SLA do chamado #{{ticket_number}} venceu.', '["ticket_number","subject","restaurant_name","sla_type"]'),
  ('SUPPORT_CUSTOMER_REPLIED', 'Cliente respondeu', 'IN_APP', 'pt-BR', NULL, 'Cliente respondeu', '{{restaurant_name}} respondeu o chamado #{{ticket_number}}.', '["ticket_number","subject","restaurant_name"]'),
  ('SUPPORT_TICKET_REOPENED', 'Chamado reaberto', 'IN_APP', 'pt-BR', NULL, 'Chamado reaberto', 'O chamado #{{ticket_number}} foi reaberto.', '["ticket_number","subject","restaurant_name"]')
ON CONFLICT (code, channel, language) DO NOTHING;

CREATE OR REPLACE FUNCTION public.support_internal_recipient_ids(_ticket_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT recipient.user_id
  FROM (
    SELECT ur.user_id
      FROM public.user_roles ur
     WHERE ur.role::text = 'admin'
    UNION
    SELECT stm.user_id
      FROM public.support_team_members stm
     WHERE stm.active = true
       AND (_ticket_id IS NULL OR EXISTS (
         SELECT 1
           FROM public.support_tickets t
          WHERE t.id = _ticket_id
            AND (
              stm.allowed_categories = '{}'::public.support_category[]
              OR t.category = ANY(stm.allowed_categories)
              OR t.assigned_to = stm.user_id
            )
       ))
  ) recipient
$$;

CREATE OR REPLACE FUNCTION public.enqueue_support_notification(
  _recipient_id uuid,
  _template_code text,
  _ticket_id uuid,
  _priority public.notification_priority DEFAULT 'NORMAL',
  _extra jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
BEGIN
  SELECT jsonb_build_object(
    'ticket_id', t.id,
    'ticket_number', COALESCE(t.ticket_number::text, '-'),
    'subject', t.subject,
    'priority', t.priority::text,
    'restaurant_id', t.restaurant_id,
    'restaurant_name', COALESCE(r.name, 'Estabelecimento')
  ) || COALESCE(_extra, '{}'::jsonb)
  INTO payload
  FROM public.support_tickets t
  LEFT JOIN public.restaurants r ON r.id = t.restaurant_id
  WHERE t.id = _ticket_id;

  IF payload IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    recipient_type,
    channel,
    template_code,
    priority,
    payload_json,
    scheduled_at,
    origin
  )
  VALUES (
    _recipient_id,
    'admin',
    'IN_APP',
    _template_code,
    _priority,
    payload,
    now(),
    'support'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_support_recipients(
  _template_code text,
  _ticket_id uuid,
  _priority public.notification_priority DEFAULT 'NORMAL',
  _extra jsonb DEFAULT '{}'::jsonb,
  _only_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient record;
BEGIN
  IF _only_user_id IS NOT NULL THEN
    PERFORM public.enqueue_support_notification(_only_user_id, _template_code, _ticket_id, _priority, _extra);
    RETURN;
  END IF;

  FOR recipient IN SELECT user_id FROM public.support_internal_recipient_ids(_ticket_id) LOOP
    PERFORM public.enqueue_support_notification(recipient.user_id, _template_code, _ticket_id, _priority, _extra);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_support_ticket_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings jsonb;
  priority_rule jsonb;
BEGIN
  SELECT support_sla_settings INTO settings
  FROM public.platform_settings
  WHERE id = true;

  priority_rule := COALESCE(
    settings #> ARRAY['priorities', NEW.priority::text],
    CASE NEW.priority
      WHEN 'urgente' THEN '{"first_response_minutes":60,"resolution_minutes":240}'::jsonb
      WHEN 'alta' THEN '{"first_response_minutes":240,"resolution_minutes":480}'::jsonb
      WHEN 'media' THEN '{"first_response_minutes":720,"resolution_minutes":1440}'::jsonb
      ELSE '{"first_response_minutes":1440,"resolution_minutes":4320}'::jsonb
    END
  );

  IF NEW.sla_due_at IS NULL THEN
    NEW.sla_due_at := NEW.created_at + make_interval(mins => COALESCE((priority_rule->>'first_response_minutes')::integer, 720));
  END IF;
  IF NEW.resolution_sla_due_at IS NULL THEN
    NEW.resolution_sla_due_at := NEW.created_at + make_interval(mins => COALESCE((priority_rule->>'resolution_minutes')::integer, 1440));
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_support_ticket_reopen_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('resolvido', 'fechado') AND NEW.status IN ('aberto', 'em_analise') THEN
    NEW.reopened_count := COALESCE(OLD.reopened_count, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_reopen_counter ON public.support_tickets;
CREATE TRIGGER support_tickets_reopen_counter
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_ticket_reopen_counter();

CREATE OR REPLACE FUNCTION public.tg_support_ticket_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_support_recipients('SUPPORT_TICKET_CREATED', NEW.id, CASE WHEN NEW.priority = 'urgente' THEN 'HIGH'::public.notification_priority ELSE 'NORMAL'::public.notification_priority END);
    IF NEW.priority = 'urgente' THEN
      PERFORM public.notify_support_recipients('SUPPORT_TICKET_URGENT', NEW.id, 'CRITICAL'::public.notification_priority);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    PERFORM public.notify_support_recipients(
      CASE WHEN OLD.assigned_to IS NULL THEN 'SUPPORT_TICKET_ASSIGNED' ELSE 'SUPPORT_TICKET_TRANSFERRED' END,
      NEW.id,
      'HIGH'::public.notification_priority,
      '{}'::jsonb,
      NEW.assigned_to
    );
  END IF;

  IF OLD.status IN ('resolvido', 'fechado') AND NEW.status IN ('aberto', 'em_analise') THEN
    PERFORM public.notify_support_recipients('SUPPORT_TICKET_REOPENED', NEW.id, 'HIGH'::public.notification_priority);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_notifications ON public.support_tickets;
CREATE TRIGGER support_tickets_notifications
  AFTER INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_ticket_notifications();

CREATE OR REPLACE FUNCTION public.tg_support_message_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_row public.support_tickets%ROWTYPE;
BEGIN
  IF NEW.internal_note OR NEW.author_type <> 'cliente' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO ticket_row FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_support_recipients('SUPPORT_MESSAGE_FROM_MERCHANT', NEW.ticket_id, 'NORMAL'::public.notification_priority);

  IF ticket_row.first_response_at IS NOT NULL THEN
    PERFORM public.notify_support_recipients('SUPPORT_CUSTOMER_REPLIED', NEW.ticket_id, 'HIGH'::public.notification_priority);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_messages_notifications ON public.support_messages;
CREATE TRIGGER support_messages_notifications
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_message_notifications();

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
       AND _now >= ticket.sla_due_at - near_threshold THEN
      PERFORM public.notify_support_recipients('SUPPORT_SLA_NEAR_DUE', ticket.id, 'HIGH'::public.notification_priority, '{"sla_type":"first_response"}'::jsonb);
      UPDATE public.support_tickets SET sla_first_response_notified_at = _now WHERE id = ticket.id;
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

REVOKE ALL ON FUNCTION public.enqueue_support_sla_notifications(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_support_sla_notifications(timestamptz) TO service_role;
