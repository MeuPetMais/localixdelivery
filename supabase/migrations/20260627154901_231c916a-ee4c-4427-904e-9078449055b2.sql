ALTER VIEW public.restaurants_public SET (security_invoker = off);
GRANT SELECT ON public.restaurants_public TO anon, authenticated;