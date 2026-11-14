-- Gate 4 H2: audit transitive dependencies without changing data or schema.
-- Run in reference Staging and isolated financial homologation. No production writes.
WITH expected_relation(name) AS (
  VALUES ('customers'),('customer_notifications'),('loyalty_transactions'),
  ('customer_loyalty'),('platform_settings'),('reward_order_event_queue'),
  ('stock_movements'),('ingredients'),('recipe_items'),
  ('builder_option_ingredients'),('builder_options'),('builder_groups'),
  ('builders'),('menu_items')
), expected_function(schema_name,fn) AS (
  VALUES ('private','consume_order_stock'),('private','reverse_order_stock'),
  ('private','rebuild_customer_order_metrics'),('public','loyalty_apply'),
  ('public','loyalty_rollback_reserve'),('private','apply_order_stock_status_transition'),
  ('private','upsert_customer_from_order'),('public','tg_order_notify_customer'),
  ('public','tg_orders_loyalty_status'),('public','tg_orders_snapshot_platform_fees'),
  ('public','tg_rewards_enqueue_order_event')
), expected_column(rel,col) AS (
  VALUES ('orders','commission_rate'),('orders','loyalty_points_reserved'),
  ('orders','loyalty_points_consumed'),('restaurants','loyalty_settings')
), checks AS (
  SELECT 'relation:'||name AS component,
    to_regclass('public.'||name) IS NOT NULL AS passes
  FROM expected_relation
  UNION ALL
  SELECT 'function:'||schema_name||'.'||fn AS component,
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname=schema_name AND p.proname=fn)
  FROM expected_function
  UNION ALL
  SELECT 'column:public.'||rel||'.'||col AS component,
    EXISTS(SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=rel AND c.column_name=col)
  FROM expected_column
)
SELECT component,passes FROM checks ORDER BY component;
