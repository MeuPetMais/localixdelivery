-- Gate 4 H2: read-only closure of financial schema's enum and trigger deps.
-- No migrations, data modification, webhook calls, or external network.
WITH expected_enum(type_name, labels) AS (
  VALUES
    ('ledger_status', ARRAY['PENDING','COMPLETED','FAILED','CANCELLED']),
    ('ledger_transaction_type', ARRAY[
      'ORDER_CREATED','PAYMENT_PENDING','PAYMENT_APPROVED','PAYMENT_FAILED',
      'PLATFORM_FEE','GATEWAY_FEE','RESTAURANT_RECEIVABLE','REFUND',
      'CHARGEBACK','PAYOUT','ADJUSTMENT'
    ]),
    ('app_role', ARRAY[
      'admin','partner','customer','financeiro','comercial','atendimento',
      'marketing','analista','delivery_driver','support_manager',
      'support_agent','partner_growth'
    ])
),
enum_checks AS (
  SELECT 'enum:' || e.type_name AS component,
    EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = e.type_name
        AND (
          SELECT array_agg(x.enumlabel::text ORDER BY x.enumsortorder)
          FROM pg_enum x WHERE x.enumtypid = t.oid
        ) = e.labels
    ) AS passes
  FROM expected_enum e
),
expected_functions(schema_name, function_name, definer) AS (
  VALUES
    ('public','tg_set_updated_at',false),
    ('public','sync_order_platform_fee_from_snapshot',false),
    ('public','assign_order_number',true),
    ('public','enforce_partner_email_only',true),
    ('public','tg_order_notify_customer',true),
    ('public','tg_orders_loyalty_status',true),
    ('public','tg_orders_snapshot_platform_fees',true),
    ('public','tg_rewards_enqueue_order_event',true),
    ('private','apply_order_stock_status_transition',true),
    ('private','upsert_customer_from_order',true)
),
function_checks AS (
  SELECT 'function:' || f.schema_name || '.' || f.function_name AS component,
    EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname=f.schema_name AND p.proname=f.function_name
        AND p.prosecdef=f.definer AND pg_get_function_result(p.oid)='trigger'
    ) AS passes
  FROM expected_functions f
),
dependency_checks AS (
  SELECT 'relation:' || name AS component,
    to_regclass('public.' || name) IS NOT NULL AS passes
  FROM (VALUES ('coupons'),('user_roles')) x(name)
),
fk_checks AS (
  SELECT 'fk:' || conname AS component,
    EXISTS (
      SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
      WHERE c.conname=conname AND r.relnamespace='public'::regnamespace
        AND c.contype='f'
    ) AS passes
  FROM (VALUES
    ('orders_coupon_id_fkey'),
    ('orders_restaurant_id_fkey'),
    ('orders_customer_id_fkey'),
    ('financial_ledger_order_id_fkey'),
    ('financial_ledger_restaurant_id_fkey'),
    ('payment_event_queue_event_id_fkey')
  ) x(conname)
)
SELECT component, passes
FROM (
  SELECT * FROM enum_checks
  UNION ALL SELECT * FROM function_checks
  UNION ALL SELECT * FROM dependency_checks
  UNION ALL SELECT * FROM fk_checks
) all_checks
ORDER BY component;
