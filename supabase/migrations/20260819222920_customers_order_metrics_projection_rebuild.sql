-- Lote 3B: authoritative customers order metrics projection.
-- Source of truth: public.orders.status.
-- Realized sale / Growth eligible statuses: entregue, concluido.

DO $$
DECLARE
  v_duplicate_groups integer := 0;
BEGIN
  SELECT count(*)::integer
  INTO v_duplicate_groups
  FROM (
    SELECT
      c.restaurant_id,
      pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') AS normalized_phone
    FROM public.customers c
    WHERE pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') <> ''
    GROUP BY
      c.restaurant_id,
      pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')
    HAVING count(*) > 1
  ) duplicate_groups;

  IF v_duplicate_groups > 0 THEN
    RAISE EXCEPTION 'customers duplicated by normalized key; sanitize public.customers before applying migration'
      USING ERRCODE = 'unique_violation',
            DETAIL = 'Duplicate groups exist for restaurant_id + regexp_replace(coalesce(phone, ''''), ''\D'', '''', ''g''). No rows were consolidated automatically.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS customers_restaurant_normalized_phone_uidx
ON public.customers (
  restaurant_id,
  (pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'))
)
WHERE pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g') <> '';

CREATE INDEX IF NOT EXISTS orders_customer_metrics_rebuild_idx
ON public.orders (
  restaurant_id,
  (pg_catalog.regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g')),
  created_at DESC
)
INCLUDE (total)
WHERE status IN ('entregue', 'concluido');

CREATE OR REPLACE FUNCTION private.rebuild_customer_order_metrics(
  _restaurant_id uuid,
  _phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_phone text := pg_catalog.regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  v_total_orders integer := 0;
  v_total_spent numeric(12,2) := 0;
  v_avg_ticket numeric(12,2) := 0;
  v_last_order_at timestamptz := null;
BEGIN
  IF _restaurant_id IS NULL OR v_phone = '' THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(_restaurant_id::text),
    pg_catalog.hashtext(v_phone)
  );

  SELECT
    count(*)::integer,
    coalesce(sum(coalesce(o.total, 0)), 0)::numeric(12,2),
    CASE
      WHEN count(*) > 0 THEN round((coalesce(sum(coalesce(o.total, 0)), 0) / count(*))::numeric, 2)::numeric(12,2)
      ELSE 0::numeric(12,2)
    END,
    max(o.created_at)
  INTO
    v_total_orders,
    v_total_spent,
    v_avg_ticket,
    v_last_order_at
  FROM public.orders o
  WHERE o.restaurant_id = _restaurant_id
    AND pg_catalog.regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g') = v_phone
    AND o.status IN ('entregue', 'concluido');

  UPDATE public.customers c
  SET total_orders = v_total_orders,
      total_spent = v_total_spent,
      avg_ticket = v_avg_ticket,
      last_order_at = v_last_order_at,
      updated_at = pg_catalog.now()
  WHERE c.restaurant_id = _restaurant_id
    AND pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.rebuild_customer_order_metrics(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.rebuild_customer_order_metrics(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION private.rebuild_customer_order_metrics(uuid, text) FROM authenticated;

CREATE OR REPLACE FUNCTION private.upsert_customer_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_phone text := pg_catalog.regexp_replace(coalesce(NEW.customer_phone, ''), '\D', '', 'g');
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF v_phone = '' OR NEW.customer_name IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.customers (restaurant_id, name, phone)
  VALUES (NEW.restaurant_id, NEW.customer_name, v_phone)
  ON CONFLICT (
    restaurant_id,
    (pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'))
  )
  WHERE pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g') <> ''
  DO UPDATE
    SET name = EXCLUDED.name,
        updated_at = pg_catalog.now();

  PERFORM private.rebuild_customer_order_metrics(NEW.restaurant_id, v_phone);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.upsert_customer_from_order() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.upsert_customer_from_order() FROM anon;
REVOKE EXECUTE ON FUNCTION private.upsert_customer_from_order() FROM authenticated;

DROP TRIGGER IF EXISTS trg_orders_upsert_customer ON public.orders;

CREATE TRIGGER trg_orders_upsert_customer
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.upsert_customer_from_order();

WITH customer_metrics AS (
  SELECT
    c.id,
    count(o.id)::integer AS total_orders,
    coalesce(sum(coalesce(o.total, 0)), 0)::numeric(12,2) AS total_spent,
    CASE
      WHEN count(o.id) > 0 THEN round((coalesce(sum(coalesce(o.total, 0)), 0) / count(o.id))::numeric, 2)::numeric(12,2)
      ELSE 0::numeric(12,2)
    END AS avg_ticket,
    max(o.created_at) AS last_order_at
  FROM public.customers c
  LEFT JOIN public.orders o
    ON o.restaurant_id = c.restaurant_id
   AND pg_catalog.regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g') = pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')
   AND o.status IN ('entregue', 'concluido')
  GROUP BY c.id
)
UPDATE public.customers c
SET total_orders = customer_metrics.total_orders,
    total_spent = customer_metrics.total_spent,
    avg_ticket = customer_metrics.avg_ticket,
    last_order_at = customer_metrics.last_order_at,
    updated_at = pg_catalog.now()
FROM customer_metrics
WHERE customer_metrics.id = c.id;

-- Local validation queries, read-only after the migration is applied:
--
-- 1. Compare persisted customer aggregates with the authoritative projection.
-- WITH expected AS (
--   SELECT
--     c.id,
--     count(o.id)::integer AS total_orders,
--     coalesce(sum(coalesce(o.total, 0)), 0)::numeric(12,2) AS total_spent,
--     CASE
--       WHEN count(o.id) > 0 THEN round((coalesce(sum(coalesce(o.total, 0)), 0) / count(o.id))::numeric, 2)::numeric(12,2)
--       ELSE 0::numeric(12,2)
--     END AS avg_ticket,
--     max(o.created_at) AS last_order_at
--   FROM public.customers c
--   LEFT JOIN public.orders o
--     ON o.restaurant_id = c.restaurant_id
--    AND pg_catalog.regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g') = pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')
--    AND o.status IN ('entregue', 'concluido')
--   GROUP BY c.id
-- )
-- SELECT c.id, c.restaurant_id, c.phone, c.total_orders, expected.total_orders, c.total_spent, expected.total_spent, c.avg_ticket, expected.avg_ticket, c.last_order_at, expected.last_order_at
-- FROM public.customers c
-- JOIN expected ON expected.id = c.id
-- WHERE c.total_orders IS DISTINCT FROM expected.total_orders
--    OR c.total_spent IS DISTINCT FROM expected.total_spent
--    OR c.avg_ticket IS DISTINCT FROM expected.avg_ticket
--    OR c.last_order_at IS DISTINCT FROM expected.last_order_at;
--
-- 2. Confirm there are no duplicate CRM identities by normalized phone.
-- SELECT
--   c.restaurant_id,
--   pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') AS normalized_phone,
--   count(*) AS customer_rows
-- FROM public.customers c
-- WHERE pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') <> ''
-- GROUP BY c.restaurant_id, pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')
-- HAVING count(*) > 1;
--
-- Rollback note: restore the previous private.upsert_customer_from_order()
-- implementation and trigger definition from migration
-- 20260625141122_b4d5fddd-8850-4617-8aa5-c2eae150b5d6.sql, drop indexes
-- customers_restaurant_normalized_phone_uidx and
-- orders_customer_metrics_rebuild_idx if reverting this contract, then rebuild
-- customer metrics from the authoritative orders table. Snapshot old customer
-- aggregates only for audit/comparison, not as a consistency source.
