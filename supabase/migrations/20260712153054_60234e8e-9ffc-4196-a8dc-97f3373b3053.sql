-- Expiração automática de pedidos aguardando pagamento (15 minutos)
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.expire_pending_payment_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id, status
      FROM public.orders
     WHERE status = 'aguardando_pagamento'
       AND created_at < now() - interval '15 minutes'
     LIMIT 500
  LOOP
    PERFORM public.order_apply_transition(
      r.id,
      r.status,
      'falha_pagamento',
      'auto_expire:15min',
      'system',
      NULL,
      jsonb_build_object('reason', 'payment_timeout')
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Desagenda job antigo (se existir) antes de reagendar (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-pending-payment-orders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-pending-payment-orders',
  '*/5 * * * *',
  $$SELECT public.expire_pending_payment_orders();$$
);