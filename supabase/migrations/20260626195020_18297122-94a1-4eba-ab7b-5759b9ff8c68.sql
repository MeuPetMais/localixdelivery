GRANT SELECT ON public.restaurants_public TO anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT ON public.reviews TO anon, authenticated;
GRANT UPDATE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;