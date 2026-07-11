ALTER TABLE public.delivery_drivers 
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS cnh_url text,
  ADD COLUMN IF NOT EXISTS address_proof_url text;