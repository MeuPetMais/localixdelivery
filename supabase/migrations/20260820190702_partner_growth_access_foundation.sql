CREATE TABLE IF NOT EXISTS public.partner_growth_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS partner_growth_assignments_user_active_idx
  ON public.partner_growth_assignments (user_id, active);

CREATE INDEX IF NOT EXISTS partner_growth_assignments_restaurant_active_idx
  ON public.partner_growth_assignments (restaurant_id, active);

ALTER TABLE public.partner_growth_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_growth_assignments TO authenticated;
GRANT ALL ON public.partner_growth_assignments TO service_role;

DROP FUNCTION IF EXISTS private.has_partner_growth_restaurant(uuid, uuid);

CREATE OR REPLACE FUNCTION private.has_partner_growth_restaurant(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  SELECT
    current_user_context.user_id IS NOT NULL
    AND private.has_role(current_user_context.user_id, 'partner_growth'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.partner_growth_assignments pga
      WHERE pga.user_id = current_user_context.user_id
        AND pga.restaurant_id = _restaurant_id
        AND pga.active = true
    )
  FROM (SELECT auth.uid() AS user_id) current_user_context;
$$;

REVOKE ALL ON FUNCTION private.has_partner_growth_restaurant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_partner_growth_restaurant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_partner_growth_role(_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id
    AND role = 'partner'::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, 'partner_growth'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_partner_growth_role(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_partner_growth_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "partner growth assignments own select" ON public.partner_growth_assignments;
CREATE POLICY "partner growth assignments own select"
  ON public.partner_growth_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "partner growth assignments admin manage" ON public.partner_growth_assignments;
CREATE POLICY "partner growth assignments admin manage"
  ON public.partner_growth_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
