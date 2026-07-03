
-- suppliers: novos campos (idempotente)
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS lead_time integer,
  ADD COLUMN IF NOT EXISTS minimum_order_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS delivery_days text[],
  ADD COLUMN IF NOT EXISTS rating numeric(3,2),
  ADD COLUMN IF NOT EXISTS preferred_supplier boolean NOT NULL DEFAULT false;

-- supplier_products: novos campos
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS ingredient_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_sku text,
  ADD COLUMN IF NOT EXISTS minimum_quantity numeric(14,3),
  ADD COLUMN IF NOT EXISTS lead_time integer,
  ADD COLUMN IF NOT EXISTS last_purchase timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- purchase_requests
DO $$ BEGIN
  CREATE TYPE public.purchase_request_status AS ENUM ('OPEN','APPROVED','REJECTED','ORDERED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  status public.purchase_request_status NOT NULL DEFAULT 'OPEN',
  reason text,
  requested_by uuid,
  approved_by uuid,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pr_restaurant ON public.purchase_requests(restaurant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requests TO authenticated;
GRANT ALL ON public.purchase_requests TO service_role;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages purchase_requests" ON public.purchase_requests
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_pr_updated_at BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- supplier_quotes
CREATE TABLE public.supplier_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  price numeric(14,4) NOT NULL,
  delivery_time integer,
  minimum_quantity numeric(14,3),
  valid_until timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sq_restaurant ON public.supplier_quotes(restaurant_id);
CREATE INDEX idx_sq_ingredient ON public.supplier_quotes(ingredient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_quotes TO authenticated;
GRANT ALL ON public.supplier_quotes TO service_role;
ALTER TABLE public.supplier_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages supplier_quotes" ON public.supplier_quotes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));
CREATE TRIGGER trg_sq_updated_at BEFORE UPDATE ON public.supplier_quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
