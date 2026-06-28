REVOKE SELECT ON public.menu_item_images FROM anon, authenticated;
GRANT SELECT (id, menu_item_id, restaurant_id, url, position, is_primary, created_at) ON public.menu_item_images TO anon, authenticated;
GRANT ALL ON public.menu_item_images TO service_role;