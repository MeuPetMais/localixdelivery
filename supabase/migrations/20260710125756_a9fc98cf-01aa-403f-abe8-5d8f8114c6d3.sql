
DO $$ BEGIN
  CREATE TYPE public.delivery_queue_status AS ENUM ('AGUARDANDO','EM_ENTREGA','RETORNANDO','INATIVO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.delivery_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  status public.delivery_queue_status NOT NULL DEFAULT 'AGUARDANDO',
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_queue_active_driver_uniq
  ON public.delivery_queue (restaurant_id, driver_id) WHERE status <> 'INATIVO';

CREATE INDEX IF NOT EXISTS delivery_queue_rest_status_pos_idx
  ON public.delivery_queue (restaurant_id, status, position);

GRANT SELECT ON public.delivery_queue TO authenticated;
GRANT ALL ON public.delivery_queue TO service_role;

ALTER TABLE public.delivery_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their restaurant queue"
  ON public.delivery_queue FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r
                 WHERE r.id = delivery_queue.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Drivers view their own queue entry"
  ON public.delivery_queue FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_drivers d
                 WHERE d.id = delivery_queue.driver_id AND d.owner_id = auth.uid()));

DROP TRIGGER IF EXISTS tg_delivery_queue_updated_at ON public.delivery_queue;
CREATE TRIGGER tg_delivery_queue_updated_at
  BEFORE UPDATE ON public.delivery_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_queue;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.queue_enqueue(_restaurant_id UUID, _driver_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_pos INT;
BEGIN
  SELECT id INTO v_id FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id AND driver_id = _driver_id AND status <> 'INATIVO' LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT COALESCE(MAX(position),0) + 1 INTO v_pos FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id AND status = 'AGUARDANDO';
  INSERT INTO public.delivery_queue (restaurant_id, driver_id, position, status, entered_at)
  VALUES (_restaurant_id, _driver_id, v_pos, 'AGUARDANDO', now()) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.queue_next_driver(_restaurant_id UUID)
RETURNS TABLE(queue_id UUID, driver_id UUID, queue_position INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, driver_id, position FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id AND status = 'AGUARDANDO'
   ORDER BY position ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.queue_dequeue(_restaurant_id UUID, _driver_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pos INT;
BEGIN
  UPDATE public.delivery_queue SET status = 'EM_ENTREGA', left_at = now()
   WHERE restaurant_id = _restaurant_id AND driver_id = _driver_id AND status = 'AGUARDANDO'
  RETURNING position INTO v_pos;
  IF v_pos IS NULL THEN RETURN false; END IF;
  UPDATE public.delivery_queue SET position = position - 1
   WHERE restaurant_id = _restaurant_id AND status = 'AGUARDANDO' AND position > v_pos;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.queue_return(_restaurant_id UUID, _driver_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pos INT; v_id UUID;
BEGIN
  UPDATE public.delivery_queue SET status = 'INATIVO', left_at = COALESCE(left_at, now())
   WHERE restaurant_id = _restaurant_id AND driver_id = _driver_id
     AND status IN ('EM_ENTREGA','RETORNANDO');
  SELECT COALESCE(MAX(position),0) + 1 INTO v_pos FROM public.delivery_queue
   WHERE restaurant_id = _restaurant_id AND status = 'AGUARDANDO';
  INSERT INTO public.delivery_queue (restaurant_id, driver_id, position, status, entered_at)
  VALUES (_restaurant_id, _driver_id, v_pos, 'AGUARDANDO', now()) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.queue_remove(_restaurant_id UUID, _driver_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pos INT;
BEGIN
  UPDATE public.delivery_queue SET status = 'INATIVO', left_at = now()
   WHERE restaurant_id = _restaurant_id AND driver_id = _driver_id AND status = 'AGUARDANDO'
  RETURNING position INTO v_pos;
  IF v_pos IS NULL THEN RETURN false; END IF;
  UPDATE public.delivery_queue SET position = position - 1
   WHERE restaurant_id = _restaurant_id AND status = 'AGUARDANDO' AND position > v_pos;
  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.queue_enqueue(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.queue_next_driver(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.queue_dequeue(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_return(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_remove(UUID, UUID) TO authenticated, service_role;
