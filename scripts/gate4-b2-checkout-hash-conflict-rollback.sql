-- Gate 4: Reject same idempotency key with changed payload hash; synthetic rollback.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
VALUES ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gate4-conflict@example.invalid',now(),now());
INSERT INTO public.restaurants(id,owner_id,name,slug,whatsapp_phone)
VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Gate4 conflict','gate4-conflict','00000000000');
SELECT * FROM public.create_order_with_snapshot_payment(_idempotency_key=>'gate4-conflict-test',_payload_hash=>'original',_restaurant_id=>'22222222-2222-4222-8222-222222222222'::uuid,_customer_id=>NULL,_customer_name=>'SYNTHETIC',_customer_phone=>'00000000000',_address=>'SYNTHETIC',_payment_method=>'pix',_items=>'[]'::jsonb,_total=>31.50,_discount=>0,_loyalty_discount=>0,_status=>'aguardando_pagamento',_snapshot_subtotal=>30.01,_snapshot_delivery_fee=>0,_snapshot_platform_fee=>1.49,_snapshot_service_fee_payer=>'customer',_snapshot_gateway_fee=>0,_snapshot_coupon_discount=>0,_snapshot_cashback=>0,_snapshot_restaurant_gross=>30.01,_snapshot_restaurant_net=>30.01,_snapshot_platform_revenue=>1.49,_snapshot_realized_platform_revenue=>1.49,_snapshot_gateway_revenue=>0,_snapshot_customer_total=>31.50,_snapshot_provider=>'mercado_pago',_snapshot_currency=>'BRL',_payment_provider=>'mercado_pago',_payment_status=>'PENDING',_payment_external_reference=>NULL);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_order_with_snapshot_payment(_idempotency_key=>'gate4-conflict-test',_payload_hash=>'mutated',_restaurant_id=>'22222222-2222-4222-8222-222222222222'::uuid,_customer_id=>NULL,_customer_name=>'SYNTHETIC',_customer_phone=>'00000000000',_address=>'SYNTHETIC',_payment_method=>'pix',_items=>'[]'::jsonb,_total=>31.50,_discount=>0,_loyalty_discount=>0,_status=>'aguardando_pagamento',_snapshot_subtotal=>30.01,_snapshot_delivery_fee=>0,_snapshot_platform_fee=>1.49,_snapshot_service_fee_payer=>'customer',_snapshot_gateway_fee=>0,_snapshot_coupon_discount=>0,_snapshot_cashback=>0,_snapshot_restaurant_gross=>30.01,_snapshot_restaurant_net=>30.01,_snapshot_platform_revenue=>1.49,_snapshot_realized_platform_revenue=>1.49,_snapshot_gateway_revenue=>0,_snapshot_customer_total=>31.50,_snapshot_provider=>'mercado_pago',_snapshot_currency=>'BRL',_payment_provider=>'mercado_pago',_payment_status=>'PENDING',_payment_external_reference=>NULL);
    RAISE EXCEPTION 'CONFLICT_WAS_NOT_REJECTED';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
SELECT (SELECT count(*) FROM public.orders) orders_after_conflict,
 (SELECT count(*) FROM public.order_payment) payment_rows_after_conflict,
 (SELECT count(*) FROM public.checkout_order_idempotency) keys_after_conflict,
 (SELECT platform_fee FROM public.orders LIMIT 1) fee_after_conflict;
ROLLBACK;
