
-- RC3.1: normalização de orders.status para vocabulário único (PT lowercase).
-- Estados oficiais: novo, aguardando_pagamento, pago, falha_pagamento, aceito,
-- rejeitado, em_preparo, pronto, saiu_para_entrega, entregue, concluido,
-- cancelado, reembolsado, chargeback.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'novo',
    'aguardando_pagamento',
    'pago',
    'falha_pagamento',
    'aceito',
    'rejeitado',
    'em_preparo',
    'pronto',
    'saiu_para_entrega',
    'entregue',
    'concluido',
    'cancelado',
    'reembolsado',
    'chargeback'
  ));

-- Trigger de notificações do cliente: usa o novo vocabulário oficial.
CREATE OR REPLACE FUNCTION public.tg_order_notify_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_title  TEXT;
  v_body   TEXT;
  v_type   TEXT;
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

  IF v_status IN ('novo', 'aguardando_pagamento') THEN
    v_type := 'order_received';
    v_title := '🆕 Pedido recebido';
    v_body := 'Seu pedido foi recebido' || COALESCE(' pela ' || v_rest_name, '') || '.';
  ELSIF v_status = 'pago' THEN
    v_type := 'order_paid';
    v_title := '💳 Pagamento aprovado';
    v_body := 'Recebemos seu pagamento. Aguardando confirmação do restaurante.';
  ELSIF v_status = 'aceito' THEN
    v_type := 'order_accepted';
    v_title := '✅ Pedido aceito';
    v_body := 'O restaurante aceitou seu pedido.';
  ELSIF v_status = 'em_preparo' THEN
    v_type := 'order_preparing';
    v_title := '👨‍🍳 Em preparo';
    v_body := 'Seu pedido já está sendo preparado.';
  ELSIF v_status = 'pronto' THEN
    v_type := 'order_ready';
    v_title := '📦 Pedido pronto';
    v_body := 'Seu pedido está pronto.';
  ELSIF v_status = 'saiu_para_entrega' THEN
    v_type := 'order_out';
    v_title := '🛵 Saiu para entrega';
    v_body := 'Seu pedido saiu para entrega.';
  ELSIF v_status IN ('entregue', 'concluido') THEN
    v_type := 'order_delivered';
    v_title := '✅ Pedido entregue';
    v_body := 'Aproveite sua refeição! Não esqueça de avaliar sua experiência.';
  ELSIF v_status IN ('cancelado', 'rejeitado', 'falha_pagamento') THEN
    v_type := 'order_canceled';
    v_title := '❌ Pedido cancelado';
    v_body := 'Seu pedido foi cancelado. Consulte o estabelecimento.';
  ELSIF v_status IN ('reembolsado', 'chargeback') THEN
    v_type := 'order_refunded';
    v_title := '↩️ Reembolso emitido';
    v_body := 'O valor do seu pedido foi devolvido.';
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
$function$;

-- Trigger de fidelidade: mapear earn_on para o vocabulário oficial.
CREATE OR REPLACE FUNCTION public.tg_orders_loyalty_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings jsonb;
  v_active   boolean;
  v_rate     numeric;
  v_min_ord  numeric;
  v_earn_on  text;
  v_earn_status text;
  v_cust_id  uuid;
  v_points   int;
  v_already  boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT loyalty_settings INTO v_settings FROM public.restaurants WHERE id = NEW.restaurant_id;
  v_active  := COALESCE((v_settings->>'active')::boolean, false);
  v_rate    := COALESCE((v_settings->>'points_per_real')::numeric, 1);
  v_min_ord := COALESCE((v_settings->>'min_order')::numeric, 0);
  v_earn_on := COALESCE(v_settings->>'earn_on', 'paid');
  v_earn_status := CASE v_earn_on WHEN 'delivered' THEN 'entregue' ELSE 'pago' END;

  SELECT id INTO v_cust_id
    FROM public.customers
   WHERE restaurant_id = NEW.restaurant_id
     AND regexp_replace(phone,'\D','','g') = regexp_replace(coalesce(NEW.customer_phone,''),'\D','','g')
   LIMIT 1;

  IF NEW.status IN ('cancelado', 'rejeitado', 'reembolsado', 'chargeback') THEN
    IF v_cust_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.loyalty_transactions
         WHERE reference_type='order' AND reference_id = NEW.id
           AND source IN ('order_paid','order_delivered')
      ) INTO v_already;
      IF v_already THEN
        PERFORM public.loyalty_apply(
          v_cust_id, NEW.restaurant_id, 'ADJUSTMENT',
          -GREATEST(floor(COALESCE(NEW.total,0) * v_rate)::int, 0),
          'cancel_reverse', 'order', NEW.id, 'Estorno por cancelamento', '{}'::jsonb
        );
      END IF;
      IF COALESCE(NEW.loyalty_points_reserved,0) > COALESCE(NEW.loyalty_points_consumed,0) THEN
        PERFORM public.loyalty_rollback_reserve(NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF v_active AND NEW.status = v_earn_status
     AND COALESCE(NEW.total,0) >= v_min_ord
     AND v_cust_id IS NOT NULL THEN
    v_points := GREATEST(floor(COALESCE(NEW.total,0) * v_rate)::int, 0);
    IF v_points > 0 THEN
      PERFORM public.loyalty_apply(
        v_cust_id, NEW.restaurant_id, 'EARN', v_points,
        CASE v_earn_on WHEN 'delivered' THEN 'order_delivered' ELSE 'order_paid' END,
        'order', NEW.id, 'Pontos do pedido', '{}'::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
