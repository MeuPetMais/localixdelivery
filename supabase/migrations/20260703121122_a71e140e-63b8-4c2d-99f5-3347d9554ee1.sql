
-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('IN_APP','PUSH','EMAIL','SMS','WHATSAPP','WEBSOCKET');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_status AS ENUM ('PENDING','PROCESSING','SENT','FAILED','RETRY','DEAD_LETTER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_priority AS ENUM ('LOW','NORMAL','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_recipient_type AS ENUM ('customer','restaurant','admin','courier','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- notification_templates
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  channel public.notification_channel NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  subject TEXT,
  title TEXT,
  body TEXT NOT NULL,
  variables_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code, channel, language)
);
GRANT SELECT ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates readable by authenticated" ON public.notification_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates managed by admins" ON public.notification_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  marketing_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start SMALLINT,
  quiet_hours_end SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own preferences" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all preferences" ON public.notification_preferences
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- notifications (queue)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID,
  recipient_type public.notification_recipient_type NOT NULL DEFAULT 'customer',
  channel public.notification_channel NOT NULL,
  template_code TEXT NOT NULL,
  status public.notification_status NOT NULL DEFAULT 'PENDING',
  priority public.notification_priority NOT NULL DEFAULT 'NORMAL',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  origin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_status_scheduled
  ON public.notifications(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON public.notifications(recipient_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipient reads own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "recipient marks read" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
CREATE POLICY "admins manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- notification_logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status public.notification_status NOT NULL,
  response JSONB,
  error_message TEXT,
  execution_time INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification
  ON public.notification_logs(notification_id, created_at DESC);
GRANT SELECT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins view notification logs" ON public.notification_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Seed default templates
INSERT INTO public.notification_templates (code, name, channel, language, subject, title, body, variables_json)
VALUES
  ('ORDER_CREATED','Pedido criado','IN_APP','pt-BR',NULL,'Pedido recebido','Seu pedido #{{order_number}} foi recebido.','["order_number"]'),
  ('ORDER_ACCEPTED','Pedido aceito','IN_APP','pt-BR',NULL,'Pedido aceito','O pedido #{{order_number}} foi aceito.','["order_number"]'),
  ('ORDER_REJECTED','Pedido rejeitado','IN_APP','pt-BR',NULL,'Pedido rejeitado','Infelizmente o pedido #{{order_number}} foi rejeitado.','["order_number"]'),
  ('PAYMENT_APPROVED','Pagamento aprovado','IN_APP','pt-BR',NULL,'Pagamento aprovado','O pagamento do pedido #{{order_number}} foi aprovado.','["order_number"]'),
  ('PAYMENT_FAILED','Pagamento falhou','IN_APP','pt-BR',NULL,'Pagamento não aprovado','O pagamento do pedido #{{order_number}} falhou.','["order_number"]'),
  ('PAYMENT_EXPIRED','Pagamento expirado','IN_APP','pt-BR',NULL,'Pagamento expirado','O pagamento do pedido #{{order_number}} expirou.','["order_number"]'),
  ('ORDER_PREPARING','Em preparo','IN_APP','pt-BR',NULL,'Em preparo','Seu pedido #{{order_number}} está sendo preparado.','["order_number"]'),
  ('ORDER_READY','Pedido pronto','IN_APP','pt-BR',NULL,'Pedido pronto','Seu pedido #{{order_number}} está pronto.','["order_number"]'),
  ('OUT_FOR_DELIVERY','Saiu para entrega','IN_APP','pt-BR',NULL,'Saiu para entrega','Seu pedido #{{order_number}} saiu para entrega.','["order_number"]'),
  ('ORDER_DELIVERED','Pedido entregue','IN_APP','pt-BR',NULL,'Entregue','Seu pedido #{{order_number}} foi entregue. Bom apetite!','["order_number"]'),
  ('ORDER_CANCELLED','Pedido cancelado','IN_APP','pt-BR',NULL,'Pedido cancelado','O pedido #{{order_number}} foi cancelado.','["order_number"]'),
  ('REFUND_CREATED','Reembolso emitido','IN_APP','pt-BR',NULL,'Reembolso emitido','Um reembolso do pedido #{{order_number}} foi emitido.','["order_number"]'),
  ('WELCOME','Boas-vindas','IN_APP','pt-BR',NULL,'Bem-vindo(a)!','Olá {{name}}, seja bem-vindo(a) ao Localix.','["name"]'),
  ('PASSWORD_RESET','Redefinir senha','EMAIL','pt-BR','Redefinição de senha','Redefinir senha','Use este link para redefinir sua senha: {{link}}','["link"]')
ON CONFLICT (code, channel, language) DO NOTHING;
