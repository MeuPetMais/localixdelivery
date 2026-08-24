-- PG-2B: alertas e priorizacao por excecao do Partner Growth.
-- Fonte autoritativa de venda realizada: src/lib/orders/order-metrics-contract.ts
-- Somente os status 'entregue' e 'concluido' contam como venda realizada.

CREATE OR REPLACE FUNCTION public.get_partner_growth_priority_alerts(
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
  v_alerts jsonb;
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
      max(ro.created_at) AS last_realized_sale_at
    FROM assigned_restaurants ar
    LEFT JOIN realized_orders ro
      ON ro.restaurant_id = ar.restaurant_id
    GROUP BY ar.restaurant_id
  ),
  customer_metrics AS (
    SELECT
      ar.restaurant_id,
      count(cs.customer_key) FILTER (
        WHERE cs.last_realized_sale_at < (_as_of - interval '30 days')
      )::integer AS inactive_30d_customers
    FROM assigned_restaurants ar
    LEFT JOIN customer_sales cs
      ON cs.restaurant_id = ar.restaurant_id
    GROUP BY ar.restaurant_id
  ),
  restaurant_rows AS (
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
      coalesce(cm.inactive_30d_customers, 0) AS inactive_30d_customers
    FROM assigned_restaurants ar
    LEFT JOIN order_metrics om
      ON om.restaurant_id = ar.restaurant_id
    LEFT JOIN customer_metrics cm
      ON cm.restaurant_id = ar.restaurant_id
  ),
  signals AS (
    SELECT
      rr.restaurant_id,
      rr.name,
      'SEM_VENDA_7D'::text AS signal,
      'ALERTA'::text AS type,
      'ALTA'::text AS priority,
      'Sem vendas realizadas nos ultimos 7 dias'::text AS reason,
      'Verificar operacao e oportunidades de reativacao'::text AS suggested_action,
      NULL::numeric AS metric_value
    FROM restaurant_rows rr
    WHERE rr.last_realized_sale_at IS NULL
       OR rr.last_realized_sale_at < (_as_of - interval '7 days')

    UNION ALL

    SELECT
      rr.restaurant_id,
      rr.name,
      'QUEDA_PEDIDOS'::text AS signal,
      'ALERTA'::text AS type,
      CASE
        WHEN rr.variation_percent <= -30 THEN 'ALTA'
        ELSE 'MEDIA'
      END AS priority,
      'Pedidos realizados cairam ' || abs(rr.variation_percent)::text || '% em relacao ao periodo anterior' AS reason,
      'Analisar causas da queda e oportunidades de recuperacao'::text AS suggested_action,
      abs(rr.variation_percent) AS metric_value
    FROM restaurant_rows rr
    WHERE rr.previous_period_orders > 0
      AND rr.variation_percent <= -15

    UNION ALL

    SELECT
      rr.restaurant_id,
      rr.name,
      'CLIENTES_INATIVOS_30D'::text AS signal,
      'ALERTA'::text AS type,
      CASE
        WHEN rr.inactive_30d_customers >= 5 THEN 'MEDIA'
        ELSE 'BAIXA'
      END AS priority,
      rr.inactive_30d_customers::text || ' clientes estao sem compra realizada ha mais de 30 dias' AS reason,
      'Avaliar estrategia de reativacao de clientes'::text AS suggested_action,
      rr.inactive_30d_customers::numeric AS metric_value
    FROM restaurant_rows rr
    WHERE rr.inactive_30d_customers >= 1

    UNION ALL

    SELECT
      rr.restaurant_id,
      rr.name,
      'BOA_EVOLUCAO'::text AS signal,
      'OPORTUNIDADE'::text AS type,
      'BAIXA'::text AS priority,
      'Pedidos realizados cresceram ' || rr.variation_percent::text || '% em relacao ao periodo anterior' AS reason,
      'Identificar praticas que podem ser reforcadas'::text AS suggested_action,
      rr.variation_percent AS metric_value
    FROM restaurant_rows rr
    WHERE rr.previous_period_orders > 0
      AND rr.variation_percent >= 20
  ),
  ordered_signals AS (
    SELECT
      s.*,
      CASE
        WHEN s.type = 'ALERTA' AND s.priority = 'ALTA' THEN 1
        WHEN s.type = 'ALERTA' AND s.priority = 'MEDIA' THEN 2
        WHEN s.type = 'ALERTA' AND s.priority = 'BAIXA' THEN 3
        ELSE 4
      END AS priority_rank
    FROM signals s
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'restaurantId', restaurant_id,
        'restaurantName', name,
        'signal', signal,
        'type', type,
        'priority', priority,
        'reason', reason,
        'suggestedAction', suggested_action,
        'metricValue', metric_value
      )
      ORDER BY priority_rank, name, signal
    ),
    '[]'::jsonb
  )
  INTO v_alerts
  FROM ordered_signals;

  RETURN jsonb_build_object(
    'alerts', v_alerts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_growth_priority_alerts(timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_partner_growth_priority_alerts(timestamptz) TO authenticated;
