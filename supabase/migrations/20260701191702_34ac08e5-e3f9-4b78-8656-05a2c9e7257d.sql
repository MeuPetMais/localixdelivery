
-- Add phone + last payment method to customer_profiles
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS last_payment_method text;

-- Customer addresses (owned by the authenticated customer, shared across all restaurants)
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Casa',
  cep text,
  street text NOT NULL,
  number text,
  complement text,
  neighborhood text NOT NULL,
  city text,
  state text,
  notes text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own addresses select" ON public.customer_addresses;
CREATE POLICY "own addresses select" ON public.customer_addresses
  FOR SELECT TO authenticated USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "own addresses insert" ON public.customer_addresses;
CREATE POLICY "own addresses insert" ON public.customer_addresses
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "own addresses update" ON public.customer_addresses;
CREATE POLICY "own addresses update" ON public.customer_addresses
  FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "own addresses delete" ON public.customer_addresses;
CREATE POLICY "own addresses delete" ON public.customer_addresses
  FOR DELETE TO authenticated USING (customer_id = auth.uid());

CREATE INDEX IF NOT EXISTS customer_addresses_customer_idx
  ON public.customer_addresses(customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_per_customer
  ON public.customer_addresses(customer_id) WHERE is_default;

CREATE OR REPLACE FUNCTION public.tg_customer_addresses_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS customer_addresses_set_updated_at ON public.customer_addresses;
CREATE TRIGGER customer_addresses_set_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.tg_customer_addresses_updated_at();

-- When a new default is set, clear other defaults for the same customer
CREATE OR REPLACE FUNCTION public.tg_customer_addresses_single_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.customer_addresses
       SET is_default = false
     WHERE customer_id = NEW.customer_id
       AND id <> NEW.id
       AND is_default;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_addresses_single_default ON public.customer_addresses;
CREATE TRIGGER customer_addresses_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.customer_addresses
  FOR EACH ROW WHEN (NEW.is_default) EXECUTE FUNCTION public.tg_customer_addresses_single_default();
