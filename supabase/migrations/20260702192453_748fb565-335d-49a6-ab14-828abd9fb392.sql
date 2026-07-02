DROP TRIGGER IF EXISTS auto_grant_admin ON auth.users;
DROP FUNCTION IF EXISTS public.tg_auto_grant_admin();