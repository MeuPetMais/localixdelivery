
CREATE TABLE public.customer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_notifications_customer ON public.customer_notifications(customer_id, created_at DESC);
CREATE INDEX idx_customer_notifications_unread ON public.customer_notifications(customer_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.customer_notifications TO authenticated;
GRANT ALL ON public.customer_notifications TO service_role;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers read own notifications"
  ON public.customer_notifications FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "customers update own notifications"
  ON public.customer_notifications FOR UPDATE TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

ALTER TABLE public.customer_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_notifications;

CREATE OR REPLACE FUNCTION public.tg_order_notify_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_title TEXT;
  v_body TEXT;
  v_type TEXT;
  v_rest_name TEXT;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_status := NEW.status;
  SELECT name INTO v_rest_name FROM public.restaurants WHERE id = NEW.restaurant_id;

  IF v_status IN ('novo', 'aguardando_confirmacao') THEN
    v_type := 'order_received';
    v_title := '🆕 Pedido recebido';
    v_body := 'Seu pedido foi recebido' || COALESCE(' pela ' || v_rest_name, '') || '.';
  ELSIF v_status = 'em_preparo' THEN
    v_type := 'order_preparing';
    v_title := '👨‍🍳 Em preparo';
    v_body := 'Seu pedido já está sendo preparado.';
  ELSIF v_status IN ('saiu_para_entrega', 'pronto') THEN
    v_type := 'order_out';
    v_title := '🛵 Saiu para entrega';
    v_body := 'Seu pedido saiu para entrega.';
  ELSIF v_status = 'entregue' THEN
    v_type := 'order_delivered';
    v_title := '✅ Pedido entregue';
    v_body := 'Aproveite sua refeição! Não esqueça de avaliar sua experiência.';
  ELSIF v_status = 'cancelado' THEN
    v_type := 'order_canceled';
    v_title := '❌ Pedido cancelado';
    v_body := 'Seu pedido foi cancelado. Consulte o estabelecimento.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.customer_notifications
    (customer_id, order_id, restaurant_id, type, title, body, data)
  VALUES
    (NEW.customer_id, NEW.id, NEW.restaurant_id, v_type, v_title, v_body,
     jsonb_build_object('order_number', NEW.order_number, 'status', v_status));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_notify_customer_ins ON public.orders;
DROP TRIGGER IF EXISTS trg_order_notify_customer_upd ON public.orders;

CREATE TRIGGER trg_order_notify_customer_ins
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_notify_customer();

CREATE TRIGGER trg_order_notify_customer_upd
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_notify_customer();
