-- customer_loyalty (saldo por cliente x restaurante)
CREATE TABLE IF NOT EXISTS public.customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'BRONZE',
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  cashback_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cashback_balance >= 0),
  lifetime_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  lifetime_cashback NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (lifetime_cashback >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, restaurant_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_customer ON public.customer_loyalty(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_restaurant ON public.customer_loyalty(restaurant_id);
GRANT SELECT ON public.customer_loyalty TO authenticated;
GRANT ALL ON public.customer_loyalty TO service_role;
ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer views own loyalty" ON public.customer_loyalty
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Restaurant owner views loyalty" ON public.customer_loyalty
  FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));
CREATE TRIGGER trg_customer_loyalty_updated
  BEFORE UPDATE ON public.customer_loyalty
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- loyalty_transactions (extrato)
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  cashback NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON public.loyalty_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_restaurant ON public.loyalty_transactions(restaurant_id, created_at DESC);
GRANT SELECT ON public.loyalty_transactions TO authenticated;
GRANT ALL ON public.loyalty_transactions TO service_role;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer views own loyalty tx" ON public.loyalty_transactions
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Owner views restaurant loyalty tx" ON public.loyalty_transactions
  FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));

-- loyalty_levels
CREATE TABLE IF NOT EXISTS public.loyalty_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  minimum_points INTEGER NOT NULL DEFAULT 0,
  benefits JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_levels_restaurant ON public.loyalty_levels(restaurant_id, display_order);
GRANT SELECT ON public.loyalty_levels TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.loyalty_levels TO authenticated;
GRANT ALL ON public.loyalty_levels TO service_role;
ALTER TABLE public.loyalty_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active levels" ON public.loyalty_levels
  FOR SELECT USING (active = true);
CREATE POLICY "Owner manages levels" ON public.loyalty_levels
  FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));
CREATE TRIGGER trg_loyalty_levels_updated
  BEFORE UPDATE ON public.loyalty_levels
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- loyalty_rules
CREATE TABLE IF NOT EXISTS public.loyalty_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  min_order NUMERIC(12,2),
  max_order NUMERIC(12,2),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_rules_restaurant ON public.loyalty_rules(restaurant_id, active, priority);
GRANT SELECT ON public.loyalty_rules TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.loyalty_rules TO authenticated;
GRANT ALL ON public.loyalty_rules TO service_role;
ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active rules" ON public.loyalty_rules
  FOR SELECT USING (active = true);
CREATE POLICY "Owner manages rules" ON public.loyalty_rules
  FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));
CREATE TRIGGER trg_loyalty_rules_updated
  BEFORE UPDATE ON public.loyalty_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();