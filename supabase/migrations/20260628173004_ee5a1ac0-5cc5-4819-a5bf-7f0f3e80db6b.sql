-- Fix: restaurants_public view was security_invoker=on which required the caller
-- to have SELECT on the underlying restaurants table. Anon users (and authenticated
-- non-owners) do not have that grant by design (privacy hardening), causing
-- "permission denied for table restaurants" when loading /{slug}.
-- Switch to security_definer (security_invoker=off) so the view runs with the
-- view owner's privileges. The view already projects only safe public columns
-- and filters to active=true, so this is safe.
ALTER VIEW public.restaurants_public SET (security_invoker = off);

-- Ensure public roles can read the view.
GRANT SELECT ON public.restaurants_public TO anon, authenticated;