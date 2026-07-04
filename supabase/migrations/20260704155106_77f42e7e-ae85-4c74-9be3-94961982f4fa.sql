
-- ============================================================
-- LOYALTY DOMAIN V2 — Consolidação
-- ============================================================

-- 1) loyalty_transactions: novos campos, source, idempotência
ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS balance_before integer,
  ADD COLUMN IF NOT EXISTS balance_after  integer,
  ADD COLUMN IF NOT EXISTS source text;

-- transaction_type esperado: EARN | REDEEM | EXPIRE | ADJUSTMENT | BONUS
-- source esperado: order_paid | order_delivered | redeem | reserve | rollback | expire | adjustment | bonus

-- Idempotência de crédito/estorno por pedido (parcial p/ não bloquear ajustes manuais)
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_tx_order_source
  ON public.loyalty_transactions (customer_id, reference_id, source)
  WHERE reference_type = 'order' AND reference_id IS NOT NULL;

-- 2) orders: campos de reserva/consumo/desconto de pontos
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_points_reserved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_consumed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_discount        numeric(12,2) NOT NULL DEFAULT 0;

-- 3) order_pricing_snapshot: fatia de desconto por pontos
ALTER TABLE public.order_pricing_snapshot
  ADD COLUMN IF NOT EXISTS loyalty_discount numeric(12,2) NOT NULL DEFAULT 0;

-- 4) restaurants: configurações do programa
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS loyalty_settings jsonb NOT NULL DEFAULT jsonb_build_object(
    'active', false,
    'points_per_real', 1,
    'min_order', 0,
    'min_redeem', 100,
    'max_discount_percent', 30,
    'validity_days', 365,
    'earn_on', 'paid'          -- 'paid' | 'delivered'
  );

-- 5) Backfill: customer_points -> customer_loyalty (por último pedido do cliente)
INSERT INTO public.customer_loyalty (customer_id, restaurant_id, points_balance, lifetime_points)
SELECT
  c.id,
  COALESCE(
    (SELECT o.restaurant_id FROM public.orders o
       WHERE o.customer_phone IS NOT NULL
         AND regexp_replace(o.customer_phone,'\D','','g') = regexp_replace(c.phone,'\D','','g')
         AND o.restaurant_id = c.restaurant_id
       ORDER BY o.created_at DESC LIMIT 1),
    c.restaurant_id
  ) AS restaurant_id,
  cp.balance,
  cp.total_earned
FROM public.customer_points cp
JOIN public.customers c ON c.id = cp.customer_id
ON CONFLICT (customer_id, restaurant_id) DO UPDATE
  SET points_balance  = GREATEST(public.customer_loyalty.points_balance, EXCLUDED.points_balance),
      lifetime_points = GREATEST(public.customer_loyalty.lifetime_points, EXCLUDED.lifetime_points),
      updated_at = now();

-- Backfill de transações históricas (marcador único de "seed")
INSERT INTO public.loyalty_transactions
  (customer_id, restaurant_id, transaction_type, points, source, description, balance_before, balance_after)
SELECT cl.customer_id, cl.restaurant_id, 'ADJUSTMENT', cl.points_balance, 'backfill',
       'Backfill de customer_points', 0, cl.points_balance
FROM public.customer_loyalty cl
WHERE cl.points_balance > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.loyalty_transactions lt
     WHERE lt.customer_id = cl.customer_id
       AND lt.restaurant_id = cl.restaurant_id
       AND lt.source = 'backfill'
  );

-- 6) Remover trigger antigo (crédito no INSERT)
DROP TRIGGER IF EXISTS trg_orders_award_points ON public.orders;
DROP FUNCTION IF EXISTS private.award_points_from_order() CASCADE;

-- 7) Dropar customer_points
DROP TABLE IF EXISTS public.customer_points CASCADE;

-- ============================================================
-- Funções auxiliares
-- ============================================================

-- Aplica delta atomicamente e registra transação
CREATE OR REPLACE FUNCTION public.loyalty_apply(
  _customer_id uuid,
  _restaurant_id uuid,
  _tx_type text,
  _points integer,           -- positivo p/ crédito, negativo p/ débito
  _source text,
  _reference_type text,
  _reference_id uuid,
  _description text,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_before int;
  v_after  int;
  v_tx_id  uuid;
BEGIN
  IF _points = 0 THEN RETURN NULL; END IF;

  INSERT INTO public.customer_loyalty (customer_id, restaurant_id, points_balance, lifetime_points)
  VALUES (_customer_id, _restaurant_id, GREATEST(_points,0), GREATEST(_points,0))
  ON CONFLICT (customer_id, restaurant_id) DO NOTHING;

  SELECT points_balance INTO v_before
    FROM public.customer_loyalty
   WHERE customer_id = _customer_id AND restaurant_id = _restaurant_id
   FOR UPDATE;

  v_after := v_before + _points;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient loyalty points (have %, need %)', v_before, -_points
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.customer_loyalty
     SET points_balance  = v_after,
         lifetime_points = lifetime_points + GREATEST(_points, 0),
         updated_at = now()
   WHERE customer_id = _customer_id AND restaurant_id = _restaurant_id;

  INSERT INTO public.loyalty_transactions
    (customer_id, restaurant_id, transaction_type, points,
     source, reference_type, reference_id, description, metadata,
     balance_before, balance_after)
  VALUES
    (_customer_id, _restaurant_id, _tx_type, _points,
     _source, _reference_type, _reference_id, _description, COALESCE(_metadata,'{}'::jsonb),
     v_before, v_after)
  ON CONFLICT ON CONSTRAINT uq_loyalty_tx_order_source DO NOTHING
  RETURNING id INTO v_tx_id;

  -- Se conflitou (idempotência), reverte o delta aplicado
  IF v_tx_id IS NULL AND _reference_type = 'order' AND _reference_id IS NOT NULL THEN
    UPDATE public.customer_loyalty
       SET points_balance  = v_before,
           lifetime_points = lifetime_points - GREATEST(_points, 0),
           updated_at = now()
     WHERE customer_id = _customer_id AND restaurant_id = _restaurant_id;
  END IF;

  RETURN v_tx_id;
END;
$$;

-- Reserva pontos no checkout (débito)
CREATE OR REPLACE FUNCTION public.loyalty_reserve(
  _order_id uuid, _customer_id uuid, _restaurant_id uuid, _points integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _points <= 0 THEN RETURN NULL; END IF;
  UPDATE public.orders
     SET loyalty_points_reserved = _points
   WHERE id = _order_id;
  RETURN public.loyalty_apply(
    _customer_id, _restaurant_id, 'REDEEM', -_points,
    'reserve', 'order', _order_id, 'Reserva de pontos p/ pedido', '{}'::jsonb
  );
END;
$$;

-- Confirma reserva (nada a fazer no saldo — só marca)
CREATE OR REPLACE FUNCTION public.loyalty_commit_reserve(_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
     SET loyalty_points_consumed = loyalty_points_reserved
   WHERE id = _order_id AND loyalty_points_reserved > 0;
END;
$$;

-- Devolve pontos reservados (estorno)
CREATE OR REPLACE FUNCTION public.loyalty_rollback_reserve(_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pts int; v_cust uuid; v_rest uuid;
BEGIN
  SELECT o.loyalty_points_reserved, cust.id, o.restaurant_id
    INTO v_pts, v_cust, v_rest
    FROM public.orders o
    LEFT JOIN public.customers cust
      ON cust.restaurant_id = o.restaurant_id
     AND regexp_replace(cust.phone,'\D','','g') = regexp_replace(coalesce(o.customer_phone,''),'\D','','g')
   WHERE o.id = _order_id;

  IF v_pts IS NULL OR v_pts <= 0 OR v_cust IS NULL THEN RETURN; END IF;

  -- Estorno via ADJUSTMENT (source distinto do reserve p/ não colidir)
  PERFORM public.loyalty_apply(
    v_cust, v_rest, 'ADJUSTMENT', v_pts,
    'rollback', 'order', _order_id, 'Devolução de reserva', '{}'::jsonb
  );

  UPDATE public.orders
     SET loyalty_points_reserved = 0, loyalty_points_consumed = 0
   WHERE id = _order_id;
END;
$$;

-- ============================================================
-- Novo trigger: credita EARN quando o pedido é pago/entregue
-- e estorna se cancelar depois. Idempotente via uq_loyalty_tx_order_source.
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_orders_loyalty_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  -- Cancelamento após crédito → estorno
  IF NEW.status = 'cancelado' THEN
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
      -- Devolve reserva se ainda houver
      IF COALESCE(NEW.loyalty_points_reserved,0) > COALESCE(NEW.loyalty_points_consumed,0) THEN
        PERFORM public.loyalty_rollback_reserve(NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Crédito EARN
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
$$;

DROP TRIGGER IF EXISTS trg_orders_loyalty_status ON public.orders;
CREATE TRIGGER trg_orders_loyalty_status
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_orders_loyalty_status();

-- ============================================================
-- Expiração de pontos (chamada via pg_cron/edge diariamente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.loyalty_expire_points()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record; v_expired int := 0; v_days int;
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
    -- soma pontos EARN mais antigos que validity_days que ainda não foram expirados/consumidos
    DECLARE v_to_expire int; BEGIN
      SELECT COALESCE(SUM(points),0) INTO v_to_expire
        FROM public.loyalty_transactions
       WHERE customer_id = r.customer_id
         AND restaurant_id = r.restaurant_id
         AND transaction_type = 'EARN'
         AND created_at < now() - make_interval(days => v_days)
         AND NOT EXISTS (
           SELECT 1 FROM public.loyalty_transactions lt2
            WHERE lt2.customer_id = r.customer_id
              AND lt2.restaurant_id = r.restaurant_id
              AND lt2.reference_type = 'earn_expiry'
              AND lt2.reference_id = loyalty_transactions.id
         );
      v_to_expire := LEAST(v_to_expire, r.points_balance);
      IF v_to_expire > 0 THEN
        PERFORM public.loyalty_apply(
          r.customer_id, r.restaurant_id, 'EXPIRE', -v_to_expire,
          'expire', 'expiry_run', gen_random_uuid(), 'Expiração automática', '{}'::jsonb
        );
        v_expired := v_expired + v_to_expire;
      END IF;
    END;
  END LOOP;
  RETURN v_expired;
END;
$$;

-- Permissões: authenticated pode chamar reserve/rollback/expire? Não — só via server fn (service_role).
REVOKE ALL ON FUNCTION public.loyalty_apply(uuid,uuid,text,int,text,text,uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loyalty_reserve(uuid,uuid,uuid,int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loyalty_commit_reserve(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loyalty_rollback_reserve(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loyalty_expire_points() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.loyalty_apply(uuid,uuid,text,int,text,text,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_reserve(uuid,uuid,uuid,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_commit_reserve(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_rollback_reserve(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_expire_points() TO service_role;
