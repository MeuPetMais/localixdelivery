-- EST-01 follow-up: only reverse stock automatically when cancellation/refund
-- happens directly from the accepted state, before preparation starts.
-- Once preparation has started, ingredients may already have been physically consumed.

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

  -- Commit recipe stock only when the restaurant accepts the order.
  IF NEW.status = 'aceito' THEN
    v_result := private.consume_order_stock(NEW.id, auth.uid());
    IF NOT COALESCE((v_result->>'ok')::boolean, false) THEN
      RAISE EXCEPTION 'ORDER_STOCK_CONSUME_FAILED:%', v_result::text;
    END IF;
  END IF;

  -- Automatic reversal is only safe before preparation starts.
  -- After em_preparo (or any later state), keep the original consumption.
  IF OLD.status = 'aceito' AND NEW.status IN ('cancelado', 'reembolsado') THEN
    v_result := private.reverse_order_stock(NEW.id, auth.uid());
    IF NOT COALESCE((v_result->>'ok')::boolean, false) THEN
      RAISE EXCEPTION 'ORDER_STOCK_REVERSE_FAILED:%', v_result::text;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION private.apply_order_stock_status_transition()
  IS 'EST-01: consumes stock on acceptance; automatically reverses only for aceito->cancelado/reembolsado before preparation starts.';
