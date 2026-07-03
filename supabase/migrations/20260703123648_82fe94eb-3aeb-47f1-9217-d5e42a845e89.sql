
-- drivers first (referenced by delivery_orders policies)
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  provider TEXT NOT NULL DEFAULT 'LOCALIX',
  vehicle_type TEXT,
  license_plate TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'OFFLINE',
  rating NUMERIC(3,2) DEFAULT 5.00,
  current_latitude NUMERIC(10,6),
  current_longitude NUMERIC(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_drivers_user ON public.drivers(user_id);
CREATE INDEX idx_drivers_status ON public.drivers(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers admin all" ON public.drivers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "drivers self select" ON public.drivers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "drivers self update" ON public.drivers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- delivery_orders
CREATE TABLE public.delivery_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'RESTAURANT',
  delivery_mode TEXT NOT NULL DEFAULT 'AUTO',
  driver_id UUID,
  status TEXT NOT NULL DEFAULT 'WAITING_ASSIGNMENT',
  estimated_pickup TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_orders_order ON public.delivery_orders(order_id);
CREATE INDEX idx_delivery_orders_restaurant ON public.delivery_orders(restaurant_id);
CREATE INDEX idx_delivery_orders_driver ON public.delivery_orders(driver_id);
CREATE INDEX idx_delivery_orders_status ON public.delivery_orders(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_orders TO authenticated;
GRANT ALL ON public.delivery_orders TO service_role;
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_orders admin all" ON public.delivery_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delivery_orders owner select" ON public.delivery_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = delivery_orders.restaurant_id AND r.owner_id = auth.uid()));
CREATE POLICY "delivery_orders owner update" ON public.delivery_orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = delivery_orders.restaurant_id AND r.owner_id = auth.uid()));
CREATE POLICY "delivery_orders driver select" ON public.delivery_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = delivery_orders.driver_id AND d.user_id = auth.uid()));
CREATE TRIGGER trg_delivery_orders_updated_at BEFORE UPDATE ON public.delivery_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- driver_locations
CREATE TABLE public.driver_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  latitude NUMERIC(10,6) NOT NULL,
  longitude NUMERIC(10,6) NOT NULL,
  speed NUMERIC(6,2),
  heading NUMERIC(6,2),
  accuracy NUMERIC(6,2),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_driver_locations_driver_time ON public.driver_locations(driver_id, captured_at DESC);
GRANT SELECT, INSERT ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_locations admin all" ON public.driver_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "driver_locations self insert" ON public.driver_locations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_locations.driver_id AND d.user_id = auth.uid()));
CREATE POLICY "driver_locations self select" ON public.driver_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_locations.driver_id AND d.user_id = auth.uid()));

-- delivery_timeline
CREATE TABLE public.delivery_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_timeline_delivery ON public.delivery_timeline(delivery_id, created_at);
GRANT SELECT, INSERT ON public.delivery_timeline TO authenticated;
GRANT ALL ON public.delivery_timeline TO service_role;
ALTER TABLE public.delivery_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_timeline admin all" ON public.delivery_timeline FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delivery_timeline owner select" ON public.delivery_timeline FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_orders dor
    JOIN public.restaurants r ON r.id = dor.restaurant_id
    WHERE dor.id = delivery_timeline.delivery_id AND r.owner_id = auth.uid()
  ));
CREATE POLICY "delivery_timeline driver select" ON public.delivery_timeline FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_orders dor
    JOIN public.drivers d ON d.id = dor.driver_id
    WHERE dor.id = delivery_timeline.delivery_id AND d.user_id = auth.uid()
  ));
