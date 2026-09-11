-- Mirrors the authoritative pricing snapshot fee into legacy order fee fields.
-- The snapshot remains the source of truth; this only keeps new order rows aligned.
CREATE OR REPLACE FUNCTION public.sync_order_platform_fee_from_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET
    platform_fee = NEW.platform_fee,
    fixed_fee = NEW.platform_fee
  WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_platform_fee_from_snapshot
  ON public.order_pricing_snapshot;

CREATE TRIGGER trg_sync_order_platform_fee_from_snapshot
  AFTER INSERT ON public.order_pricing_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_platform_fee_from_snapshot();
