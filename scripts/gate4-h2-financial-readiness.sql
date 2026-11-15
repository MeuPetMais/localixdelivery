-- Gate 4 H2: diagnostic ONLY. Executes no DDL, DML, migrations, or remote calls.
-- Run exclusively on authorized disposable homologation project.
WITH required_tables(name) AS (
  VALUES
    ('restaurants'), ('orders'), ('order_pricing_snapshot'),
    ('order_payment'), ('payments'), ('financial_ledger'),
    ('payment_webhook_events'), ('payment_event_queue'),
    ('mercado_pago_accounts'), ('checkout_order_idempotency')
), required_rpcs(name) AS (
  VALUES ('create_order_with_snapshot_payment'),
         ('get_restaurant_financial_snapshot')
)
SELECT
  'table' AS kind,
  t.name,
  to_regclass('public.' || t.name) IS NOT NULL AS present,
  COALESCE((SELECT c.relrowsecurity
            FROM pg_class c
            WHERE c.oid = to_regclass('public.' || t.name)), false) AS rls_enabled
FROM required_tables t
UNION ALL
SELECT
  'rpc', f.name,
  EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = f.name
  ), false
FROM required_rpcs f
ORDER BY kind, name;
