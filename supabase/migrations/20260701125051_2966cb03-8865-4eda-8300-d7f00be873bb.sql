CREATE OR REPLACE FUNCTION private.consume_stock_from_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item jsonb;
  v_raw text;
  v_item_id uuid;
  v_qty numeric;
BEGIN
  IF NEW.items IS NULL THEN
    RETURN NEW;
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    v_raw := NULLIF(item->>'id','');
    v_qty := COALESCE((item->>'qty')::numeric, 0);
    -- Skip lines whose id is not a plain UUID (e.g. "Monte do Seu Jeito" composite ids like "builder:<uuid>:<ts>")
    IF v_raw IS NULL OR v_qty <= 0 OR v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      CONTINUE;
    END IF;
    v_item_id := v_raw::uuid;
    UPDATE public.ingredients ing
    SET stock = ing.stock - (ri.quantity * v_qty)
    FROM public.recipe_items ri
    WHERE ri.menu_item_id = v_item_id
      AND ri.ingredient_id = ing.id
      AND ing.restaurant_id = NEW.restaurant_id;
  END LOOP;
  RETURN NEW;
END;
$function$;