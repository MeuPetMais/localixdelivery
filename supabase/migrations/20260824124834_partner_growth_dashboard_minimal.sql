-- PG-2A: dashboard minimo do Partner Growth.
-- Fonte autoritativa de venda realizada: src/lib/orders/order-metrics-contract.ts
-- Somente os status 'entregue' e 'concluido' contam como venda realizada.

CREATE OR REPLACE FUNCTION public.get_partner_growth_dashboard(
  _as_of timestamptz DEFAULT pg_catalog.now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_start timestamptz := date_trunc('month', _as_of);
  v_current_end timestamptz := _as_of;
  v_previous_start timestamptz := v_current_start - (_as_of - v_current_start);
  v_previous_end timestamptz := v_current_start;
  v_dashboard jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT private.has_role(v_user_id, 'partner_growth'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH assigned_restaurants AS (
    SELECT
      r.id AS restaurant_id,
      r.name
    FROM public.partner_growth_assignments pga
    JOIN public.restaurants r
      ON r.id = pga.restaurant_id
    WHERE pga.user_id = v_user_id
      AND pga.active = true
      AND private.has_partner_growth_restaurant(r.id)
  ),
  realized_orders AS (
    SELECT
      o.id,
      o.restaurant_id,
      o.created_at,
      CASE
        WHEN o.customer_id IS NOT NULL THEN o.customer_id::text
        ELSE NULLIF(pg_catalog.regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), '')
      END AS customer_key
    FROM public.orders o
    JOIN assigned_restaurants ar
      ON ar.restaurant_id = o.restaurant_id
    WHERE o.status IN ('entregue', 'concluido')
  ),
  customer_sales AS (
    SELECT
      ro.restaurant_id,
      ro.customer_key,
      count(*)::integer AS realized_sales,
      max(ro.created_at) AS last_realized_sale_at
    FROM realized_orders ro
    WHERE ro.customer_key IS NOT NULL
    GROUP BY ro.restaurant_id, ro.customer_key
  ),
  order_metrics AS (
    SELECT
      ar.restaurant_id,
      count(ro.id) FILTER (
        WHERE ro.created_at >= v_current_start
          AND ro.created_at < v_current_end
      )::integer AS current_period_orders,
      count(ro.id) FILTER (
        WHERE ro.created_at >= v_previous_start
          AND ro.created_at < v_previous_end
      )::integer AS previous_period_orders,
      max(ro.created_at) AS last_realized_sale_at,
      count(DISTINCT ro.customer_key) FILTER (
        WHERE ro.customer_key IS NOT NULL
          AND ro.created_at >= v_current_start
          AND ro.created_at < v_current_end
      )::integer AS unique_customers_with_realized_sale
    FROM assigned_restaurants ar
    LEFT JOIN realized_orders ro
      ON ro.restaurant_id = ar.restaurant_id
    GROUP BY ar.restaurant_id
  ),
  customer_metrics AS (
    SELECT
      ar.restaurant_id,
      count(cs.customer_key) FILTER (
        WHERE cs.realized_sales >= 2
      )::integer AS recurring_customers,
      count(cs.customer_key) FILTER (
        WHERE cs.last_realized_sale_at < (_as_of - interval '30 days')
      )::integer AS inactive_30d_customers
    FROM assigned_restaurants ar
    LEFT JOIN customer_sales cs
      ON cs.restaurant_id = ar.restaurant_id
    GROUP BY ar.restaurant_id
  ),
  rows AS (
    SELECT
      ar.restaurant_id,
      ar.name,
      coalesce(om.current_period_orders, 0) AS current_period_orders,
      coalesce(om.previous_period_orders, 0) AS previous_period_orders,
      CASE
        WHEN coalesce(om.previous_period_orders, 0) = 0
          AND coalesce(om.current_period_orders, 0) = 0 THEN 0
        WHEN coalesce(om.previous_period_orders, 0) = 0 THEN NULL
        ELSE round(
          ((coalesce(om.current_period_orders, 0) - om.previous_period_orders)::numeric
            / om.previous_period_orders::numeric) * 100,
          2
        )
      END AS variation_percent,
      om.last_realized_sale_at,
      coalesce(om.unique_customers_with_realized_sale, 0) AS unique_customers_with_realized_sale,
      coalesce(cm.recurring_customers, 0) AS recurring_customers,
      coalesce(cm.inactive_30d_customers, 0) AS inactive_30d_customers
    FROM assigned_restaurants ar
    LEFT JOIN order_metrics om
      ON om.restaurant_id = ar.restaurant_id
    LEFT JOIN customer_metrics cm
      ON cm.restaurant_id = ar.restaurant_id
  ),
  summary AS (
    SELECT
      count(*)::integer AS partners_count,
      coalesce(sum(current_period_orders), 0)::integer AS current_month_orders,
      coalesce(sum(previous_period_orders), 0)::integer AS previous_period_orders,
      CASE
        WHEN coalesce(sum(previous_period_orders), 0) = 0
          AND coalesce(sum(current_period_orders), 0) = 0 THEN 0
        WHEN coalesce(sum(previous_period_orders), 0) = 0 THEN NULL
        ELSE round(
          ((coalesce(sum(current_period_orders), 0) - coalesce(sum(previous_period_orders), 0))::numeric
            / coalesce(sum(previous_period_orders), 0)::numeric) * 100,
          2
        )
      END AS variation_percent,
      count(*) FILTER (
        WHERE last_realized_sale_at IS NULL
           OR last_realized_sale_at < (_as_of - interval '7 days')
      )::integer AS partners_without_sale_7d,
      coalesce(sum(unique_customers_with_realized_sale), 0)::integer AS customers_with_realized_sale,
      coalesce(sum(recurring_customers), 0)::integer AS recurring_customers,
      coalesce(sum(inactive_30d_customers), 0)::integer AS inactive_30d_customers
    FROM rows
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'current_start', v_current_start,
      'current_end', v_current_end,
      'previous_start', v_previous_start,
      'previous_end', v_previous_end
    ),
    'summary', (
      SELECT jsonb_build_object(
        'partners_count', partners_count,
        'current_month_orders', current_month_orders,
        'previous_period_orders', previous_period_orders,
        'variation_percent', variation_percent,
        'partners_without_sale_7d', partners_without_sale_7d,
        'customers_with_realized_sale', customers_with_realized_sale,
        'recurring_customers', recurring_customers,
        'inactive_30d_customers', inactive_30d_customers
      )
      FROM summary
    ),
    'restaurants', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'restaurant_id', restaurant_id,
            'name', name,
            'current_period_orders', current_period_orders,
            'previous_period_orders', previous_period_orders,
            'variation_percent', variation_percent,
            'last_realized_sale_at', last_realized_sale_at,
            'unique_customers_with_realized_sale', unique_customers_with_realized_sale,
            'recurring_customers', recurring_customers,
            'inactive_30d_customers', inactive_30d_customers
          )
          ORDER BY name
        )
        FROM rows
      ),
      '[]'::jsonb
    )
  )
  INTO v_dashboard;

  RETURN v_dashboard;
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_growth_dashboard(timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_partner_growth_dashboard(timestamptz) TO authenticated;
