
-- Toggle on restaurants
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS builders_enabled boolean NOT NULL DEFAULT false;

-- Builders (templates: Monte sua Pizza, etc.)
CREATE TABLE public.builders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text,
  description text,
  image_url text,
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.builders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builders TO authenticated;
GRANT ALL ON public.builders TO service_role;
ALTER TABLE public.builders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active builders" ON public.builders FOR SELECT
  USING (is_active = true AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = builders.restaurant_id AND r.builders_enabled = true));
CREATE POLICY "Owners manage builders" ON public.builders FOR ALL
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = builders.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = builders.restaurant_id AND r.owner_id = auth.uid()));
CREATE INDEX idx_builders_restaurant ON public.builders(restaurant_id);

-- Groups (Tamanho, Massa, Borda, Sabores, Adicionais...)
CREATE TABLE public.builder_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id uuid NOT NULL REFERENCES public.builders(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_select integer NOT NULL DEFAULT 0,
  max_select integer NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.builder_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builder_groups TO authenticated;
GRANT ALL ON public.builder_groups TO service_role;
ALTER TABLE public.builder_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view groups" ON public.builder_groups FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.builders b JOIN public.restaurants r ON r.id = b.restaurant_id
                 WHERE b.id = builder_groups.builder_id AND b.is_active = true AND r.builders_enabled = true));
CREATE POLICY "Owners manage groups" ON public.builder_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM public.builders b JOIN public.restaurants r ON r.id = b.restaurant_id
                 WHERE b.id = builder_groups.builder_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.builders b JOIN public.restaurants r ON r.id = b.restaurant_id
                      WHERE b.id = builder_groups.builder_id AND r.owner_id = auth.uid()));
CREATE INDEX idx_builder_groups_builder ON public.builder_groups(builder_id);

-- Options inside a group (Pequena R$0, Média +R$10, Catupiry +R$5...)
CREATE TABLE public.builder_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.builder_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_delta numeric(10,2) NOT NULL DEFAULT 0,
  max_qty integer NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.builder_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builder_options TO authenticated;
GRANT ALL ON public.builder_options TO service_role;
ALTER TABLE public.builder_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view options" ON public.builder_options FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.builder_groups g
                 JOIN public.builders b ON b.id = g.builder_id
                 JOIN public.restaurants r ON r.id = b.restaurant_id
                 WHERE g.id = builder_options.group_id AND b.is_active = true AND r.builders_enabled = true));
CREATE POLICY "Owners manage options" ON public.builder_options FOR ALL
  USING (EXISTS (SELECT 1 FROM public.builder_groups g
                 JOIN public.builders b ON b.id = g.builder_id
                 JOIN public.restaurants r ON r.id = b.restaurant_id
                 WHERE g.id = builder_options.group_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.builder_groups g
                      JOIN public.builders b ON b.id = g.builder_id
                      JOIN public.restaurants r ON r.id = b.restaurant_id
                      WHERE g.id = builder_options.group_id AND r.owner_id = auth.uid()));
CREATE INDEX idx_builder_options_group ON public.builder_options(group_id);

CREATE TRIGGER tg_builders_updated_at BEFORE UPDATE ON public.builders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
