-- GATE4 B2: Synthetic checkout idempotency test in ONE transaction; all effects rolled back.
BEGIN;
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gate4-synthetic@example.invalid',now(),now());
INSERT INTO public.restaurants (id,owner_id,name,slug,whatsapp_phone)
VALUES ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','GATE4 SYNTHETIC','gate4-synthetic','00000000000');
CREATE TEMP TABLE gate4_checkout_results (call_index integer, order_id uuid, order_number integer, reused boolean) ON COMMIT DROP;
INSERT INTO gate4_checkout_results SELECT 1,x.* FROM public.create_order_with_snapshot_payment(_idempotency_key => 'gate4-b2-synthetic-key',_payload_hash => 'gate4-b2-synthetic-hash',_restaurant_id => '22222222-2222-4222-8222-222222222222'::uuid,_customer_id => NULL,_customer_name => 'SYNTHETIC TEST',_customer_phone => '00000000000',_address => 'SYNTHETIC',_payment_method => 'pix',_items => '[]'::jsonb,_total => 30.99,_discount => 0,_loyalty_discount => 0,_status => 'aguardando_pagamento',_snapshot_subtotal => 30,_snapshot_delivery_fee => 0,_snapshot_platform_fee => 0.99,_snapshot_service_fee_payer => 'customer',_snapshot_gateway_fee => 0,_snapshot_coupon_discount => 0,_snapshot_cashback => 0,_snapshot_restaurant_gross => 30,_snapshot_restaurant_net => 30,_snapshot_platform_revenue => 0.99,_snapshot_realized_platform_revenue => 0.99,_snapshot_gateway_revenue => 0,_snapshot_customer_total => 30.99,_snapshot_provider => 'mercado_pago',_snapshot_currency => 'BRL',_payment_provider => 'mercado_pago',_payment_status => 'PENDING',_payment_external_reference => NULL) x;
INSERT INTO gate4_checkout_results SELECT 2,x.* FROM public.create_order_with_snapshot_payment(_idempotency_key => 'gate4-b2-synthetic-key',_payload_hash => 'gate4-b2-synthetic-hash',_restaurant_id => '22222222-2222-4222-8222-222222222222'::uuid,_customer_id => NULL,_customer_name => 'SYNTHETIC TEST',_customer_phone => '00000000000',_address => 'SYNTHETIC',_payment_method => 'pix',_items => '[]'::jsonb,_total => 30.99,_discount => 0,_loyalty_discount => 0,_status => 'aguardando_pagamento',_snapshot_subtotal => 30,_snapshot_delivery_fee => 0,_snapshot_platform_fee => 0.99,_snapshot_service_fee_payer => 'customer',_snapshot_gateway_fee => 0,_snapshot_coupon_discount => 0,_snapshot_cashback => 0,_snapshot_restaurant_gross => 30,_snapshot_restaurant_net => 30,_snapshot_platform_revenue => 0.99,_snapshot_realized_platform_revenue => 0.99,_snapshot_gateway_revenue => 0,_snapshot_customer_total => 30.99,_snapshot_provider => 'mercado_pago',_snapshot_currency => 'BRL',_payment_provider => 'mercado_pago',_payment_status => 'PENDING',_payment_external_reference => NULL) x;
SELECT
 (SELECT count(*) FROM public.orders) AS orders_count,
 (SELECT count(*) FROM public.order_payment) AS order_payment_count,
 (SELECT count(*) FROM public.order_pricing_snapshot) AS pricing_count,
 (SELECT count(*) FROM public.checkout_order_idempotency) AS idempotency_count,
 (SELECT count(*) FROM gate4_checkout_results) AS calls,
 (SELECT reused FROM gate4_checkout_results WHERE call_index=1) AS first_reused,
 (SELECT reused FROM gate4_checkout_results WHERE call_index=2) AS second_reused,
 (SELECT count(DISTINCT order_id) FROM gate4_checkout_results) AS distinct_order_ids,
 (SELECT order_number FROM public.orders LIMIT 1) AS assigned_order_number,
 (SELECT platform_fee FROM public.orders LIMIT 1) AS synced_platform_fee;
ROLLBACK;
