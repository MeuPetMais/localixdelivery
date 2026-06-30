-- Restore table grants on public.restaurants for owners.
-- A prior security migration revoked ALL grants leaving authenticated owners
-- unable to read their own restaurant via the browser client, which caused
-- the dashboard onboarding form to appear for users who already have one.
-- RLS policies already restrict access (owner sees only own row; anon goes
-- through restaurants_public view).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;