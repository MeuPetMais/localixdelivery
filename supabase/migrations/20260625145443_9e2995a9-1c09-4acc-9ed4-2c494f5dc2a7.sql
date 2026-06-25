
CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  stock numeric(12,3) NOT NULL DEFAULT 0,
  min_stock numeric(12,3) NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients TO authenticated;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their ingredients"
  ON public.ingredients FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = ingredients.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = ingredients.restaurant_id AND r.owner_id = auth.uid()));

CREATE TRIGGER tg_ingredients_updated_at BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX ingredients_restaurant_idx ON public.ingredients(restaurant_id);

CREATE TABLE public.recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(menu_item_id, ingredient_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_items TO authenticated;
GRANT ALL ON public.recipe_items TO service_role;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their recipes"
  ON public.recipe_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.menu_items mi
    JOIN public.restaurants r ON r.id = mi.restaurant_id
    WHERE mi.id = recipe_items.menu_item_id AND r.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.menu_items mi
    JOIN public.restaurants r ON r.id = mi.restaurant_id
    WHERE mi.id = recipe_items.menu_item_id AND r.owner_id = auth.uid()
  ));

CREATE INDEX recipe_items_menu_idx ON public.recipe_items(menu_item_id);
CREATE INDEX recipe_items_ingredient_idx ON public.recipe_items(ingredient_id);

-- Auto-decrement stock on order insert
CREATE OR REPLACE FUNCTION private.consume_stock_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  v_item_id uuid;
  v_qty numeric;
BEGIN
  IF NEW.items IS NULL THEN
    RETURN NEW;
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    v_item_id := NULLIF(item->>'id','')::uuid;
    v_qty := COALESCE((item->>'qty')::numeric, 0);
    IF v_item_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;
    UPDATE public.ingredients ing
    SET stock = ing.stock - (ri.quantity * v_qty)
    FROM public.recipe_items ri
    WHERE ri.menu_item_id = v_item_id
      AND ri.ingredient_id = ing.id
      AND ing.restaurant_id = NEW.restaurant_id;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_orders_consume_stock
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.consume_stock_from_order();
