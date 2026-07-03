
DO $$ BEGIN
  CREATE TYPE public.production_order_status AS ENUM ('PLANNED','IN_PROGRESS','PAUSED','COMPLETED','CANCELLED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.production_batch_status AS ENUM ('ACTIVE','CONSUMED','EXPIRED','DISCARDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- production_orders
CREATE TABLE IF NOT EXISTS public.production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.product_recipes(id) ON DELETE RESTRICT,
  batch_number TEXT,
  planned_quantity NUMERIC NOT NULL CHECK (planned_quantity > 0),
  produced_quantity NUMERIC NOT NULL DEFAULT 0,
  status public.production_order_status NOT NULL DEFAULT 'PLANNED',
  planned_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_finish TIMESTAMPTZ,
  expiration_date TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO authenticated;
GRANT ALL ON public.production_orders TO service_role;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_orders_owner_all" ON public.production_orders FOR ALL
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_prod_orders_updated BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_prod_orders_rest ON public.production_orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_prod_orders_recipe ON public.production_orders(recipe_id);

-- production_consumption
CREATE TABLE IF NOT EXISTS public.production_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  planned_quantity NUMERIC NOT NULL DEFAULT 0,
  consumed_quantity NUMERIC NOT NULL DEFAULT 0,
  loss_quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_consumption TO authenticated;
GRANT ALL ON public.production_consumption TO service_role;
ALTER TABLE public.production_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_cons_owner_all" ON public.production_consumption FOR ALL
  USING (EXISTS (SELECT 1 FROM public.production_orders p JOIN public.restaurants r ON r.id = p.restaurant_id
                 WHERE p.id = production_order_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.production_orders p JOIN public.restaurants r ON r.id = p.restaurant_id
                      WHERE p.id = production_order_id AND r.owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_prod_cons_order ON public.production_consumption(production_order_id);

-- production_output
CREATE TABLE IF NOT EXISTS public.production_output (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  produced_quantity NUMERIC NOT NULL DEFAULT 0,
  approved_quantity NUMERIC NOT NULL DEFAULT 0,
  rejected_quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_output TO authenticated;
GRANT ALL ON public.production_output TO service_role;
ALTER TABLE public.production_output ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_out_owner_all" ON public.production_output FOR ALL
  USING (EXISTS (SELECT 1 FROM public.production_orders p JOIN public.restaurants r ON r.id = p.restaurant_id
                 WHERE p.id = production_order_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.production_orders p JOIN public.restaurants r ON r.id = p.restaurant_id
                      WHERE p.id = production_order_id AND r.owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_prod_out_order ON public.production_output(production_order_id);

-- production_losses
CREATE TABLE IF NOT EXISTS public.production_losses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL CHECK (quantity >= 0),
  reason TEXT,
  cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_losses TO authenticated;
GRANT ALL ON public.production_losses TO service_role;
ALTER TABLE public.production_losses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_loss_owner_all" ON public.production_losses FOR ALL
  USING (EXISTS (SELECT 1 FROM public.production_orders p JOIN public.restaurants r ON r.id = p.restaurant_id
                 WHERE p.id = production_order_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.production_orders p JOIN public.restaurants r ON r.id = p.restaurant_id
                      WHERE p.id = production_order_id AND r.owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_prod_loss_order ON public.production_losses(production_order_id);

-- production_batches
CREATE TABLE IF NOT EXISTS public.production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  batch_code TEXT NOT NULL,
  manufacturing_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiration_date TIMESTAMPTZ,
  status public.production_batch_status NOT NULL DEFAULT 'ACTIVE',
  quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batches TO authenticated;
GRANT ALL ON public.production_batches TO service_role;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_batch_owner_all" ON public.production_batches FOR ALL
  USING (EXISTS (SELECT 1 FROM public.production_orders p JOIN public.restaurants r ON r.id = p.restaurant_id
                 WHERE p.id = production_order_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.production_orders p JOIN public.restaurants r ON r.id = p.restaurant_id
                      WHERE p.id = production_order_id AND r.owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_prod_batch_order ON public.production_batches(production_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_batch_exp ON public.production_batches(expiration_date) WHERE status = 'ACTIVE';
