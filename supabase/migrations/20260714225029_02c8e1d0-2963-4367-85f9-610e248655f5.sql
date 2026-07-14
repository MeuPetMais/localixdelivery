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
  v_method TEXT;
  v_offline BOOLEAN;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_status := NEW.status;
  v_method := lower(coalesce(NEW.payment_method, ''));
  v_offline := v_method IN (
    'cash','dinheiro','especie','espécie',
    'card_on_delivery','cartao na entrega','cartão na entrega',
    'meal_voucher','food_voucher','vr','va',
    'vale refeicao','vale refeição','vale alimentacao','vale alimentação'
  );

  SELECT name INTO v_rest_name FROM public.restaurants WHERE id = NEW.restaurant_id;

  IF v_status IN ('novo', 'aguardando_pagamento') THEN
    v_type := 'order_received';
    v_title := '🆕 Pedido recebido';
    v_body := 'Seu pedido foi recebido' || COALESCE(' pela ' || v_rest_name, '') || '.';
  ELSIF v_status = 'pago' THEN
    IF v_offline THEN
      v_type := 'order_received';
      v_title := '🧾 Pedido recebido';
      v_body := 'Seu pedido foi enviado ao restaurante. O pagamento será realizado na entrega.';
    ELSE
      v_type := 'order_paid';
      v_title := '💳 Pagamento aprovado';
      v_body := 'Recebemos seu pagamento. Aguardando confirmação do restaurante.';
    END IF;
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
     jsonb_build_object('order_number', NEW.order_number, 'status', v_status, 'payment_method', NEW.payment_method));

  RETURN NEW;
END;
$function$;