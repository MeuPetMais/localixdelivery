ALTER TABLE public.restaurants 
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS cnpj text;