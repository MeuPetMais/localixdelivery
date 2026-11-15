-- Gate 4 / homologação isolada: regressões SEC-01 + FIN-02.
-- Apenas dados sintéticos, transação revertida. Não cria ou altera schema.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email) VALUES
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gate4-sec-user@invalid.example'),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gate4-sec-admin@invalid.example');
INSERT INTO public.user_roles(user_id,role) VALUES ('22222222-2222-4222-8222-222222222222','admin');
INSERT INTO public.restaurants(id,owner_id,name,slug,whatsapp_phone) VALUES
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Sandbox test','sandbox-harden','000');
DO $test$ DECLARE blocked boolean:=false; BEGIN
 BEGIN
 INSERT INTO public.payments(restaurant_id,provider,method,status,amount,net_amount,platform_fee)
 VALUES ('33333333-3333-4333-8333-333333333333','mercado_pago','pix','approved',10,10,0);
 EXCEPTION WHEN check_violation THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'ORPHAN_APPROVED_ACCEPTED'; END IF;
END $test$;
INSERT INTO public.payments(restaurant_id,provider,method,status,amount,net_amount,platform_fee)
VALUES ('33333333-3333-4333-8333-333333333333','mercado_pago','pix','pending',10,10,0);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $test$ BEGIN
 IF public.has_role('22222222-2222-4222-8222-222222222222'::uuid,'admin') THEN
   RAISE EXCEPTION 'FOREIGN_ROLE_LEAK';
 END IF;
 IF public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'NONADMIN_MISCLASSIFIED'; END IF;
END $test$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $test$ BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'ADMIN_ROLE_BROKEN'; END IF;
END $test$;
SELECT public.has_role(auth.uid(),'admin') AS admin_visible_own_role,
  (SELECT count(*) FROM public.payments WHERE status='pending' AND order_id IS NULL) AS pending_unlinked_allowed;
ROLLBACK;
