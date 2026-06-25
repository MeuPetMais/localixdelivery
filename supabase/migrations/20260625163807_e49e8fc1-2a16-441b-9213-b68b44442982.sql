
-- Allow public storefront to read restaurants_public view, categories and items.
-- View is owned by postgres; with security_invoker=off it bypasses RLS on the base table,
-- exposing ONLY the safe columns selected by the view (whatsapp_phone, owner_name, cnpj are excluded).
ALTER VIEW public.restaurants_public SET (security_invoker = off);

GRANT SELECT ON public.restaurants_public TO anon, authenticated;
GRANT SELECT ON public.menu_categories TO anon;
GRANT SELECT ON public.menu_items TO anon;
