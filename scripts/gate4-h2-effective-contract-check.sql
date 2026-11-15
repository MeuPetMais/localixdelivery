-- Gate 4 H2 — contract acceptance for the FINAL effective schema.
-- Read only. Valid for staging baseline and for a disposable homologation database.
-- The expected facts below were checked directly against Supabase shared staging
-- on 2026-11-14; this is NOT a copy of production data or secrets.
WITH
  required_tables(table_name, min_policies, min_triggers) AS (
    VALUES
      ('restaurants',6,1),('orders',2,9),
      ('order_pricing_snapshot',1,1),('order_payment',1,1),
      ('payments',1,1),('financial_ledger',2,1),
      ('payment_webhook_events',1,1),('payment_event_queue',1,1),
      ('mercado_pago_accounts',0,1),('checkout_order_idempotency',0,0)
  ),
  table_checks AS (
    SELECT 'table:' || r.table_name AS component,
           (c.oid IS NOT NULL
            AND c.relrowsecurity
            AND (SELECT count(*) FROM pg_policies p
                 WHERE p.schemaname = 'public' AND p.tablename = r.table_name) >= r.min_policies
            AND (SELECT count(*) FROM pg_trigger t
                 WHERE t.tgrelid = c.oid AND NOT t.tgisinternal) >= r.min_triggers
           ) AS passes
    FROM required_tables r
    LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || r.table_name)
  ),
  trigger_checks AS (
    SELECT 'trigger:' || x.relname || '.' || x.tgname AS component,
           EXISTS (
             SELECT 1 FROM pg_trigger t
             JOIN pg_class c ON c.oid=t.tgrelid
             WHERE c.oid = to_regclass('public.' || x.relname)
               AND t.tgname = x.tgname
               AND t.tgenabled IN ('O','A')
           ) AS passes
    FROM (VALUES
      ('orders','orders_set_updated_at'),
      ('orders','orders_snapshot_platform_fees'),
      ('orders','tg_orders_stock_status_transition'),
      ('orders','trg_order_notify_customer_ins'),
      ('orders','trg_order_notify_customer_upd'),
      ('orders','trg_orders_assign_number'),
      ('orders','trg_orders_loyalty_status'),
      ('orders','trg_orders_upsert_customer'),
      ('orders','trg_rewards_enqueue_order_event'),
      ('order_pricing_snapshot','trg_sync_order_platform_fee_from_snapshot'),
      ('financial_ledger','trg_fin_ledger_updated_at'),
      ('payment_event_queue','trg_payment_event_queue_updated_at'),
      ('payment_webhook_events','trg_payment_webhook_events_updated_at')
    ) x(relname,tgname)
  ),
  policy_checks AS (
    SELECT 'policy:' || x.relname || '.' || x.policy AS component,
           EXISTS (
             SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
             AND p.tablename=x.relname AND p.policyname=x.policy
             AND p.cmd='SELECT' AND 'authenticated'=ANY(p.roles)
           ) AS passes
    FROM (VALUES
      ('orders','Customers view own orders'),
      ('orders','Owners view their orders'),
      ('financial_ledger','Restaurant owners read own ledger'),
      ('financial_ledger','Admins read all ledger'),
      ('order_payment','Owners view their restaurant payments'),
      ('order_pricing_snapshot','Owners view their restaurant snapshots'),
      ('payment_webhook_events','admins read webhook events'),
      ('payment_event_queue','admins read event queue')
    ) x(relname,policy)
  ),
  rpc_checks AS (
    SELECT 'rpc:' || r.name AS component,
           EXISTS (SELECT 1 FROM pg_proc p
             JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname=r.name
             AND NOT p.prosecdef) AS passes
    FROM (VALUES
      ('create_order_with_snapshot_payment'),
      ('get_restaurant_financial_snapshot')
    ) r(name)
  )
SELECT component,passes
FROM (SELECT * FROM table_checks UNION ALL SELECT * FROM trigger_checks
      UNION ALL SELECT * FROM policy_checks UNION ALL SELECT * FROM rpc_checks) checks
ORDER BY component;
