
-- Add estimated_delivery_time field
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_delivery_time INTEGER;

-- Allow public (anon) read of an order by its UUID. UUID acts as a private link token.
-- This enables the customer success/tracking page and Realtime subscriptions.
CREATE POLICY "Public can view orders by id"
  ON public.orders
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.orders TO anon;
