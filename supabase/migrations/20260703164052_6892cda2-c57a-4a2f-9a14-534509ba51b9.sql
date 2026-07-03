
-- Enums
DO $$ BEGIN
  CREATE TYPE public.promotion_status AS ENUM ('DRAFT','SCHEDULED','ACTIVE','PAUSED','EXPIRED','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.promotion_discount_type AS ENUM ('FIXED_AMOUNT','PERCENTAGE','FIXED_PRICE','BUY_X_GET_Y','FREE_ITEM','FREE_DELIVERY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- promotions
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status public.promotion_status NOT NULL DEFAULT 'DRAFT',
  priority INT NOT NULL DEFAULT 100,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  discount_type public.promotion_discount_type NOT NULL,
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  stackable BOOLEAN NOT NULL DEFAULT false,
  code TEXT,
  channel TEXT,
  max_uses INT,
  max_uses_per_customer INT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotions_restaurant ON public.promotions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON public.promotions(restaurant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_promotions_code ON public.promotions(restaurant_id, code) WHERE code IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT SELECT ON public.promotions TO anon;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_owner_all" ON public.promotions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "promotions_public_active_read" ON public.promotions FOR SELECT
  USING (status = 'ACTIVE');

CREATE TRIGGER trg_promotions_updated_at BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- promotion_rules
CREATE TABLE IF NOT EXISTS public.promotion_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'eq',
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotion_rules_promotion ON public.promotion_rules(promotion_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_rules TO authenticated;
GRANT SELECT ON public.promotion_rules TO anon;
GRANT ALL ON public.promotion_rules TO service_role;
ALTER TABLE public.promotion_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotion_rules_owner_all" ON public.promotion_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.promotions p JOIN public.restaurants r ON r.id = p.restaurant_id WHERE p.id = promotion_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.promotions p JOIN public.restaurants r ON r.id = p.restaurant_id WHERE p.id = promotion_id AND r.owner_id = auth.uid()));

CREATE POLICY "promotion_rules_public_read" ON public.promotion_rules FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.promotions p WHERE p.id = promotion_id AND p.status = 'ACTIVE'));

-- promotion_targets
CREATE TABLE IF NOT EXISTS public.promotion_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotion_targets_promotion ON public.promotion_targets(promotion_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_targets TO authenticated;
GRANT SELECT ON public.promotion_targets TO anon;
GRANT ALL ON public.promotion_targets TO service_role;
ALTER TABLE public.promotion_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotion_targets_owner_all" ON public.promotion_targets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.promotions p JOIN public.restaurants r ON r.id = p.restaurant_id WHERE p.id = promotion_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.promotions p JOIN public.restaurants r ON r.id = p.restaurant_id WHERE p.id = promotion_id AND r.owner_id = auth.uid()));

CREATE POLICY "promotion_targets_public_read" ON public.promotion_targets FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.promotions p WHERE p.id = promotion_id AND p.status = 'ACTIVE'));

-- promotion_usage
CREATE TABLE IF NOT EXISTS public.promotion_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id UUID,
  order_id UUID,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion ON public.promotion_usage(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_customer ON public.promotion_usage(customer_id);

GRANT SELECT, INSERT ON public.promotion_usage TO authenticated;
GRANT ALL ON public.promotion_usage TO service_role;
ALTER TABLE public.promotion_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotion_usage_owner_read" ON public.promotion_usage FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "promotion_usage_insert" ON public.promotion_usage FOR INSERT
  WITH CHECK (true);
