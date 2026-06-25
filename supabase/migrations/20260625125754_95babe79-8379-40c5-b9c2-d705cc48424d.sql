-- Remove public SELECT on restaurants (sensitive whatsapp_phone). Public access goes through restaurants_public view.
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;

-- Drop the publicly-exposed has_role wrapper. RLS policies already use private.has_role.
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Lock down execute on private.has_role: only authenticated may call it (needed by RLS).
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;