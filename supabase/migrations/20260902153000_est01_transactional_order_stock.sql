-- EST-01: transactional, auditable and idempotent stock consumption.
-- Scope: recipe_items -> ingredients -> stock_movements.
-- Builder/options remain out of scope until they have explicit ingredient bindings.

-- The legacy trigger consumed stock at order INSERT, before the restaurant accepted the order,
-- and changed ingredients.stock without writing stock_movements.
DROP TRIGGER IF EXISTS tg_orders_consume_stock ON public.orders;

-- One consumption and one reversal per order + ingredient.
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_order_consume_uidx
  ON public.stock_movements (reference_id, ingredient_id)
  WHERE reference_type = 'order'
    AND COALESCE(metadata->>'operation', '') = 'consume';

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_order_reverse_uidx
  ON public.stock_movements (reference_id, ingredient_id)
  WHERE reference_type = 'order'
    AND COALESCE(metadata->>'operation', '') = 'reverse';

CREATE OR REPLACE FUNCTION private.consume_order_stock(
  _order_id uuid,
  _performed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_restaurant_id uuid;
  v_items jsonb;
  v_req record;
  v_previous numeric;
  v_new numeric;
  v_consumed_count integer := 0;
BEGIN
  SELECT restaurant_id, items
    INTO v_restaurant_id, v_items
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ORDER_NOT_FOUND');
  END IF;

  -- Idempotent no-op when this order was already consumed.
  IF EXISTS (
    SELECT 1
      FROM public.stock_movements sm
     WHERE sm.reference_type = 'order'
       AND sm.reference_id = _order_id
       AND COALESCE(sm.metadata->>'operation', '') = 'consume'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true, 'consumed_ingredients', 0);
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' THEN
    RETURN jsonb_build_object('ok', true, 'consumed_ingredients', 0);
  END IF;

  -- Phase 1: lock every required ingredient in deterministic order and validate stock.
  -- No balance is changed in this phase, so an insufficiency cannot leave a partial deduction.
  FOR v_req IN
    WITH order_lines AS (
      SELECT
        (line->>'id')::uuid AS menu_item_id,
        COALESCE(NULLIF(line->>'qty', '')::numeric, 0) AS item_qty
      FROM jsonb_array_elements(v_items) AS line
      WHERE COALESCE(line->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND COALESCE(NULLIF(line->>'qty', '')::numeric, 0) > 0
    )
    SELECT
      ri.ingredient_id,
      ing.name AS ingredient_name,
      ing.unit AS ingredient_unit,
      SUM(ri.quantity * ol.item_qty)::numeric AS required_qty
    FROM order_lines ol
    JOIN public.recipe_items ri ON ri.menu_item_id = ol.menu_item_id
    JOIN public.ingredients ing ON ing.id = ri.ingredient_id
    WHERE ing.restaurant_id = v_restaurant_id
    GROUP BY ri.ingredient_id, ing.name, ing.unit
    ORDER BY ri.ingredient_id
  LOOP
    SELECT stock
      INTO v_previous
      FROM public.ingredients
     WHERE id = v_req.ingredient_id
       AND restaurant_id = v_restaurant_id
     FOR UPDATE;

    IF v_previous IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'INGREDIENT_NOT_FOUND',
        'ingredient_id', v_req.ingredient_id,
        'ingredient_name', v_req.ingredient_name
      );
    END IF;

    IF v_previous < v_req.required_qty THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'INSUFFICIENT_STOCK',
        'ingredient_id', v_req.ingredient_id,
        'ingredient_name', v_req.ingredient_name,
        'unit', v_req.ingredient_unit,
        'available', v_previous,
        'required', v_req.required_qty
      );
    END IF;
  END LOOP;

  -- Phase 2: all rows are locked and validated; perform the deductions and ledger writes.
  FOR v_req IN
    WITH order_lines AS (
      SELECT
        (line->>'id')::uuid AS menu_item_id,
        COALESCE(NULLIF(line->>'qty', '')::numeric, 0) AS item_qty
      FROM jsonb_array_elements(v_items) AS line
      WHERE COALESCE(line->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND COALESCE(NULLIF(line->>'qty', '')::numeric, 0) > 0
    )
    SELECT
      ri.ingredient_id,
      ing.name AS ingredient_name,
      ing.unit AS ingredient_unit,
      SUM(ri.quantity * ol.item_qty)::numeric AS required_qty
    FROM order_lines ol
    JOIN public.recipe_items ri ON ri.menu_item_id = ol.menu_item_id
    JOIN public.ingredients ing ON ing.id = ri.ingredient_id
    WHERE ing.restaurant_id = v_restaurant_id
    GROUP BY ri.ingredient_id, ing.name, ing.unit
    ORDER BY ri.ingredient_id
  LOOP
    SELECT stock
      INTO v_previous
      FROM public.ingredients
     WHERE id = v_req.ingredient_id
       AND restaurant_id = v_restaurant_id
     FOR UPDATE;

    v_new := v_previous - v_req.required_qty;

    UPDATE public.ingredients
       SET stock = v_new
     WHERE id = v_req.ingredient_id
       AND restaurant_id = v_restaurant_id;

    INSERT INTO public.stock_movements (
      ingredient_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reason,
      reference_type,
      reference_id,
      performed_by,
      metadata
    ) VALUES (
      v_req.ingredient_id,
      'SALE'::public.stock_movement_type,
      v_req.required_qty,
      v_previous,
      v_new,
      'Consumo automático por aceite de pedido',
      'order',
      _order_id,
      _performed_by,
      jsonb_build_object(
        'operation', 'consume',
        'source', 'recipe_items',
        'ingredient_unit', v_req.ingredient_unit
      )
    );

    v_consumed_count := v_consumed_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'consumed_ingredients', v_consumed_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.reverse_order_stock(
  _order_id uuid,
  _performed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_row record;
  v_previous numeric;
  v_new numeric;
  v_reversed_count integer := 0;
BEGIN
  -- Lock the order so reversal is serialized with status transitions for the same order.
  PERFORM 1
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ORDER_NOT_FOUND');
  END IF;

  -- Lock all affected ingredient rows in deterministic order first.
  FOR v_row IN
    SELECT sm.ingredient_id
      FROM public.stock_movements sm
     WHERE sm.reference_type = 'order'
       AND sm.reference_id = _order_id
       AND COALESCE(sm.metadata->>'operation', '') = 'consume'
     ORDER BY sm.ingredient_id
  LOOP
    PERFORM 1
      FROM public.ingredients
     WHERE id = v_row.ingredient_id
     FOR UPDATE;
  END LOOP;

  FOR v_row IN
    SELECT sm.id AS consume_movement_id,
           sm.ingredient_id,
           sm.quantity,
           sm.metadata
      FROM public.stock_movements sm
     WHERE sm.reference_type = 'order'
       AND sm.reference_id = _order_id
       AND COALESCE(sm.metadata->>'operation', '') = 'consume'
     ORDER BY sm.ingredient_id
  LOOP
    -- Idempotent per ingredient. Never add stock twice for the same order consumption.
    IF EXISTS (
      SELECT 1
        FROM public.stock_movements rev
       WHERE rev.reference_type = 'order'
         AND rev.reference_id = _order_id
         AND rev.ingredient_id = v_row.ingredient_id
         AND COALESCE(rev.metadata->>'operation', '') = 'reverse'
    ) THEN
      CONTINUE;
    END IF;

    SELECT stock
      INTO v_previous
      FROM public.ingredients
     WHERE id = v_row.ingredient_id
     FOR UPDATE;

    IF v_previous IS NULL THEN
      RAISE EXCEPTION 'STOCK_REVERSAL_INGREDIENT_NOT_FOUND:%', v_row.ingredient_id;
    END IF;

    v_new := v_previous + v_row.quantity;

    UPDATE public.ingredients
       SET stock = v_new
     WHERE id = v_row.ingredient_id;

    INSERT INTO public.stock_movements (
      ingredient_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reason,
      reference_type,
      reference_id,
      performed_by,
      metadata
    ) VALUES (
      v_row.ingredient_id,
      'RELEASE'::public.stock_movement_type,
      v_row.quantity,
      v_previous,
      v_new,
      'Reversão de consumo por cancelamento/reembolso do pedido',
      'order',
      _order_id,
      _performed_by,
      jsonb_build_object(
        'operation', 'reverse',
        'source', 'stock_movement',
        'consume_movement_id', v_row.consume_movement_id,
        'ingredient_unit', v_row.metadata->>'ingredient_unit'
      )
    );

    v_reversed_count := v_reversed_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'reversed_ingredients', v_reversed_count);
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_order_stock_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Stock becomes operationally committed only when the restaurant accepts the order.
  IF NEW.status = 'aceito' THEN
    v_result := private.consume_order_stock(NEW.id, auth.uid());
    IF NOT COALESCE((v_result->>'ok')::boolean, false) THEN
      RAISE EXCEPTION 'ORDER_STOCK_CONSUME_FAILED:%', v_result::text;
    END IF;
  END IF;

  -- Reversal is ledger-based and therefore safe even when no stock was ever consumed.
  IF NEW.status IN ('cancelado', 'reembolsado') THEN
    v_result := private.reverse_order_stock(NEW.id, auth.uid());
    IF NOT COALESCE((v_result->>'ok')::boolean, false) THEN
      RAISE EXCEPTION 'ORDER_STOCK_REVERSE_FAILED:%', v_result::text;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_orders_stock_status_transition ON public.orders;
CREATE TRIGGER tg_orders_stock_status_transition
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION private.apply_order_stock_status_transition();

COMMENT ON FUNCTION private.consume_order_stock(uuid, uuid)
  IS 'EST-01: consumes recipe_items stock transactionally on order acceptance and writes idempotent stock_movements.';

COMMENT ON FUNCTION private.reverse_order_stock(uuid, uuid)
  IS 'EST-01: reverses the exact original order stock consumption once, based on stock_movements.';
