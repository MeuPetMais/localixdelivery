
-- ingredient_cost_history
CREATE TABLE public.ingredient_cost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  supplier_id uuid,
  purchase_order_id uuid,
  unit_cost numeric(14,4) NOT NULL,
  average_cost numeric(14,4),
  currency text NOT NULL DEFAULT 'BRL',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ich_ingredient ON public.ingredient_cost_history(ingredient_id, effective_from DESC);
CREATE INDEX idx_ich_restaurant ON public.ingredient_cost_history(restaurant_id);
GRANT SELECT, INSERT, UPDATE ON public.ingredient_cost_history TO authenticated;
GRANT ALL ON public.ingredient_cost_history TO service_role;
ALTER TABLE public.ingredient_cost_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads ingredient_cost_history" ON public.ingredient_cost_history
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  );
CREATE POLICY "owner writes ingredient_cost_history" ON public.ingredient_cost_history
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  );

-- recipe_cost_snapshot
CREATE TABLE public.recipe_cost_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  recipe_id uuid NOT NULL,
  recipe_version integer NOT NULL DEFAULT 1,
  ingredient_cost numeric(14,4) NOT NULL DEFAULT 0,
  labor_cost numeric(14,4) NOT NULL DEFAULT 0,
  overhead_cost numeric(14,4) NOT NULL DEFAULT 0,
  packaging_cost numeric(14,4) NOT NULL DEFAULT 0,
  total_cost numeric(14,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rcs_recipe ON public.recipe_cost_snapshot(recipe_id, created_at DESC);
GRANT SELECT, INSERT ON public.recipe_cost_snapshot TO authenticated;
GRANT ALL ON public.recipe_cost_snapshot TO service_role;
ALTER TABLE public.recipe_cost_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads recipe_cost_snapshot" ON public.recipe_cost_snapshot
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  );
CREATE POLICY "owner writes recipe_cost_snapshot" ON public.recipe_cost_snapshot
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  );

-- product_profitability
CREATE TABLE public.product_profitability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  sale_price numeric(14,4) NOT NULL DEFAULT 0,
  recipe_cost numeric(14,4) NOT NULL DEFAULT 0,
  gross_margin numeric(14,4) NOT NULL DEFAULT 0,
  net_margin numeric(14,4) NOT NULL DEFAULT 0,
  estimated_profit numeric(14,4) NOT NULL DEFAULT 0,
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, product_id)
);
CREATE INDEX idx_pp_restaurant ON public.product_profitability(restaurant_id);
GRANT SELECT, INSERT, UPDATE ON public.product_profitability TO authenticated;
GRANT ALL ON public.product_profitability TO service_role;
ALTER TABLE public.product_profitability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages product_profitability" ON public.product_profitability
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  );
CREATE TRIGGER trg_pp_updated_at BEFORE UPDATE ON public.product_profitability
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- order_profitability
CREATE TABLE public.order_profitability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  restaurant_id uuid NOT NULL,
  gross_revenue numeric(14,4) NOT NULL DEFAULT 0,
  delivery_cost numeric(14,4) NOT NULL DEFAULT 0,
  gateway_fee numeric(14,4) NOT NULL DEFAULT 0,
  platform_fee numeric(14,4) NOT NULL DEFAULT 0,
  recipe_cost numeric(14,4) NOT NULL DEFAULT 0,
  packaging_cost numeric(14,4) NOT NULL DEFAULT 0,
  estimated_profit numeric(14,4) NOT NULL DEFAULT 0,
  net_profit numeric(14,4) NOT NULL DEFAULT 0,
  margin_percentage numeric(8,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_op_restaurant_created ON public.order_profitability(restaurant_id, created_at DESC);
GRANT SELECT, INSERT ON public.order_profitability TO authenticated;
GRANT ALL ON public.order_profitability TO service_role;
ALTER TABLE public.order_profitability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads order_profitability" ON public.order_profitability
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  );
CREATE POLICY "owner writes order_profitability" ON public.order_profitability
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  );
