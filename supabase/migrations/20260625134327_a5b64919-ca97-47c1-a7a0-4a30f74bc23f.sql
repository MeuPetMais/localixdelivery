
-- Normalize status values and add constraint
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'novo';
UPDATE public.orders SET status = 'novo' WHERE status NOT IN ('novo','em_preparo','saiu_para_entrega','entregue','cancelado');
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('novo','em_preparo','saiu_para_entrega','entregue','cancelado'));

-- Trigger to keep updated_at in sync
DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
END $$;
