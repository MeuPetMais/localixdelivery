
DO $$ BEGIN
  CREATE TYPE public.product_insight_type AS ENUM (
    'BEST_SELLER','LOW_SELLER','HIGH_MARGIN','LOW_MARGIN',
    'OUT_OF_STOCK','PRICE_REVIEW','PROMOTION','CROSS_SELL','UPSELL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_insight_severity AS ENUM ('info','warning','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.product_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id UUID,
  insight_type public.product_insight_type NOT NULL,
  severity public.product_insight_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_insights_restaurant ON public.product_insights(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_insights_product ON public.product_insights(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_insights TO authenticated;
GRANT ALL ON public.product_insights TO service_role;
ALTER TABLE public.product_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_insights_owner_all" ON public.product_insights FOR ALL
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.product_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,
  product_id UUID,
  related_product_id UUID,
  score NUMERIC(10,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_recs_restaurant ON public.product_recommendations(restaurant_id, recommendation_type, score DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_recommendations TO authenticated;
GRANT ALL ON public.product_recommendations TO service_role;
ALTER TABLE public.product_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_recs_owner_all" ON public.product_recommendations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));
