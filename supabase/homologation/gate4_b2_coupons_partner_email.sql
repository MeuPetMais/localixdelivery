-- Gate4: actual coupon table source, real order FK and partner email-only gate.
-- Only isolated homologation project; no loyalty/stock/notification hooks or seed.
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  valid_until date,
  is_active boolean NOT NULL DEFAULT true,
  uses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, code)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own coupons" ON public.coupons FOR ALL TO authenticated
 USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=coupons.restaurant_id AND r.owner_id=auth.uid()))
 WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=coupons.restaurant_id AND r.owner_id=auth.uid()));
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
ALTER TABLE public.orders ADD COLUMN coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.enforce_partner_email_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_provider text;
BEGIN
 SELECT COALESCE(raw_app_meta_data->>'provider','email') INTO v_provider FROM auth.users WHERE id=NEW.owner_id;
 IF v_provider IS NOT NULL AND v_provider<>'email' THEN RAISE EXCEPTION 'Parceiros devem se cadastrar exclusivamente com e-mail e senha (provider=%).',v_provider USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_partner_email_only() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_restaurants_partner_email_only BEFORE INSERT ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.enforce_partner_email_only();
