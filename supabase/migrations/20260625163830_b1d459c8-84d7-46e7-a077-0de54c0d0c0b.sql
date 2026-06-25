
-- Switch view back to security_invoker so it enforces caller's RLS/privileges (linter requirement)
ALTER VIEW public.restaurants_public SET (security_invoker = on);

-- Allow anon to read the base table BUT only the safe columns (whatsapp_phone, owner_name, cnpj excluded)
GRANT SELECT (
  id, name, slug, description, logo_url, cover_url,
  delivery_fee, min_order, is_open, created_at, updated_at
) ON public.restaurants TO anon, authenticated;

-- Public RLS policy: anyone can read restaurant rows (column grants above restrict which fields)
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;
CREATE POLICY "Public can view restaurants"
  ON public.restaurants FOR SELECT
  TO anon, authenticated
  USING (true);
