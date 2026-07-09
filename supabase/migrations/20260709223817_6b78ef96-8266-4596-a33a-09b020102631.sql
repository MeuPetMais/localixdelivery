
-- Add delivery_driver role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delivery_driver';

-- Enums
DO $$ BEGIN
  CREATE TYPE public.delivery_driver_status AS ENUM ('ativo','inativo','afastado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_driver_vehicle AS ENUM ('moto','bicicleta','carro','a_pe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  cpf TEXT,
  photo_url TEXT,
  vehicle_type public.delivery_driver_vehicle NOT NULL DEFAULT 'moto',
  vehicle_plate TEXT,
  document_url TEXT,
  status public.delivery_driver_status NOT NULL DEFAULT 'ativo',
  online BOOLEAN NOT NULL DEFAULT false,
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_restaurant ON public.delivery_drivers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_owner ON public.delivery_drivers(owner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_status ON public.delivery_drivers(restaurant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_drivers_owner_unique ON public.delivery_drivers(owner_id) WHERE owner_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_drivers TO authenticated;
GRANT ALL ON public.delivery_drivers TO service_role;

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

-- Owner (dono do restaurante) tem CRUD nos seus motoboys
CREATE POLICY "Owner manages own restaurant drivers"
  ON public.delivery_drivers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Motoboy vê apenas o próprio cadastro
CREATE POLICY "Driver sees own profile"
  ON public.delivery_drivers
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Motoboy pode atualizar seu próprio status online e localização
CREATE POLICY "Driver updates own presence"
  ON public.delivery_drivers
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Trigger updated_at
CREATE TRIGGER trg_delivery_drivers_updated_at
  BEFORE UPDATE ON public.delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_drivers;

-- Audit
CREATE TABLE IF NOT EXISTS public.delivery_driver_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_driver_audit_driver ON public.delivery_driver_audit(driver_id);

GRANT SELECT, INSERT ON public.delivery_driver_audit TO authenticated;
GRANT ALL ON public.delivery_driver_audit TO service_role;

ALTER TABLE public.delivery_driver_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads driver audit"
  ON public.delivery_driver_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
