-- Gate4 H2: admin scope in financial snapshot, synthetic and rolled back.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at) VALUES
 ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gate4-restaurant-owner@example.invalid',now(),now()),
 ('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gate4-admin@example.invalid',now(),now());
INSERT INTO public.restaurants(id,owner_id,name,slug,whatsapp_phone)
 VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Gate4 synthetic shop','gate4-admin-policy','00000000000');
INSERT INTO public.user_roles(user_id,role) VALUES('33333333-3333-4333-8333-333333333333','admin');
INSERT INTO public.financial_ledger(restaurant_id,provider,transaction_type,reference_type,reference_id,amount,status)
 VALUES('22222222-2222-4222-8222-222222222222','mercado_pago','PAYMENT_PENDING','synthetic','admin-scope',10,'PENDING');
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SET LOCAL ROLE authenticated;
SELECT public.has_role(auth.uid(),'admin') AS is_admin,
 (public.get_restaurant_financial_snapshot('22222222-2222-4222-8222-222222222222')->>'row_count')::int AS admin_visible_rows;
RESET ROLE;
ROLLBACK;
