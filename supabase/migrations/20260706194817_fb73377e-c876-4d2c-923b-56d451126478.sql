ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_account_type text DEFAULT 'express',
  ADD COLUMN IF NOT EXISTS stripe_onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_account_status text DEFAULT 'not_created',
  ADD COLUMN IF NOT EXISTS stripe_last_sync timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_stripe_account_id_key
  ON public.restaurants(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;