-- Remove public SELECT on restaurants (sensitive whatsapp_phone). Public access goes through restaurants_public view.
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;

-- Keep public.has_role because existing RLS policies still depend on it.
-- Add private.has_role as a compatibility wrapper for later migrations that use it.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, _role)
$$;

-- Lock down execute on private.has_role: only authenticated may call it (needed by RLS).
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
