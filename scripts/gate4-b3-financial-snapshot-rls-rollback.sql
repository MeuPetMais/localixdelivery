-- Gate 4 H2/H3: RLS isolation test for financial snapshot. SYNTHETIC DATA ONLY.
-- The entire test must be rolled back; no checkout, MP calls or jobs.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at) VALUES
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gate4-owner-a@example.invalid',now(),now()),
('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gate4-owner-b@example.invalid',now(),now());
INSERT INTO public.restaurants(id,owner_id,name,slug,whatsapp_phone) VALUES
('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Gate4 A','gate4-owner-a','00000000000'),
('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','Gate4 B','gate4-owner-b','00000000000');
INSERT INTO public.financial_ledger(restaurant_id,provider,transaction_type,amount,status,reference_type,reference_id)
VALUES ('22222222-2222-4222-8222-222222222222','mercado_pago','PAYMENT_PENDING',10,'PENDING','synthetic','a'),
('44444444-4444-4444-8444-444444444444','mercado_pago','PAYMENT_PENDING',20,'PENDING','synthetic','b');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
SELECT
 (public.get_restaurant_financial_snapshot('22222222-2222-4222-8222-222222222222')->>'row_count')::int AS owner_own_rows,
 (public.get_restaurant_financial_snapshot('44444444-4444-4444-8444-444444444444')->>'row_count')::int AS owner_other_rows,
 (public.get_restaurant_financial_snapshot('22222222-2222-4222-8222-222222222222')->>'complete')::boolean AS snapshot_complete;
RESET ROLE;
ROLLBACK;
