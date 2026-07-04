
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Tabela de eventos (preparada para o NotificationCenter)
CREATE TABLE IF NOT EXISTS public.loyalty_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  event_type text NOT NULL,           -- PointsExpiring, PointsExpired
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL,           -- garante idempotência por customer/tipo/janela
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_events TO authenticated;
GRANT ALL ON public.loyalty_events TO service_role;

ALTER TABLE public.loyalty_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads loyalty events"
  ON public.loyalty_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r
             WHERE r.id = loyalty_events.restaurant_id AND r.owner_id = auth.uid())
    OR customer_id = auth.uid()
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_events_dedupe
  ON public.loyalty_events (customer_id, restaurant_id, event_type, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_restaurant
  ON public.loyalty_events (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_customer
  ON public.loyalty_events (customer_id, created_at DESC);

-- Função: varre pontos EARN próximos de expirar (30/7/1 dias) e publica evento
CREATE OR REPLACE FUNCTION public.loyalty_scan_expiring()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_windows int[] := ARRAY[30, 7, 1];
  w int;
  v_days int;
  v_expire_at timestamptz;
  v_points int;
  v_inserted int := 0;
BEGIN
  FOR r IN
    SELECT cl.customer_id, cl.restaurant_id, cl.points_balance,
           COALESCE((rest.loyalty_settings->>'validity_days')::int, 365) AS validity_days
      FROM public.customer_loyalty cl
      JOIN public.restaurants rest ON rest.id = cl.restaurant_id
     WHERE cl.points_balance > 0
       AND COALESCE((rest.loyalty_settings->>'active')::boolean, false) = true
  LOOP
    v_days := r.validity_days;
    FOREACH w IN ARRAY v_windows LOOP
      SELECT COALESCE(SUM(points),0), MIN(created_at + make_interval(days => v_days))
        INTO v_points, v_expire_at
        FROM public.loyalty_transactions
       WHERE customer_id = r.customer_id
         AND restaurant_id = r.restaurant_id
         AND transaction_type = 'EARN'
         AND created_at + make_interval(days => v_days) > now()
         AND created_at + make_interval(days => v_days) <= now() + make_interval(days => w)
         AND created_at + make_interval(days => v_days) > now() + make_interval(days => CASE w WHEN 30 THEN 7 WHEN 7 THEN 1 ELSE 0 END);

      IF v_points > 0 THEN
        BEGIN
          INSERT INTO public.loyalty_events
            (restaurant_id, customer_id, event_type, payload, dedupe_key)
          VALUES
            (r.restaurant_id, r.customer_id, 'PointsExpiring',
             jsonb_build_object('points', v_points, 'days', w, 'expire_at', v_expire_at),
             'w' || w || ':' || to_char(v_expire_at, 'YYYY-MM-DD'));
          v_inserted := v_inserted + 1;
        EXCEPTION WHEN unique_violation THEN
          -- já publicado nesta janela
          NULL;
        END;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.loyalty_scan_expiring() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_scan_expiring() TO service_role;

-- Cron diário: expira + gera eventos de pré-aviso
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'loyalty-daily-lifecycle') THEN
    PERFORM cron.unschedule('loyalty-daily-lifecycle');
  END IF;
  PERFORM cron.schedule(
    'loyalty-daily-lifecycle',
    '0 3 * * *',
    $cron$
      SELECT public.loyalty_expire_points();
      SELECT public.loyalty_scan_expiring();
    $cron$
  );
END $$;
