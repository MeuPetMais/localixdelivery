DROP INDEX IF EXISTS public.payments_provider_external_uk;
ALTER TABLE public.payments ADD CONSTRAINT payments_provider_external_uk UNIQUE (provider, external_id);