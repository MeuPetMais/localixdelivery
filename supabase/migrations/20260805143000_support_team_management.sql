CREATE TABLE IF NOT EXISTS public.support_team_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role public.app_role NOT NULL CHECK (role::text IN ('support_manager', 'support_agent')),
  active boolean NOT NULL DEFAULT true,
  allowed_categories public.support_category[] NOT NULL DEFAULT '{}'::public.support_category[],
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz,
  accepted_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS support_team_members_email_idx
  ON public.support_team_members (lower(email));
CREATE INDEX IF NOT EXISTS support_team_members_role_idx
  ON public.support_team_members (role, active);

CREATE TABLE IF NOT EXISTS public.support_team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  role public.app_role NOT NULL CHECK (role::text IN ('support_manager', 'support_agent')),
  allowed_categories public.support_category[] NOT NULL DEFAULT '{}'::public.support_category[],
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS support_team_invites_pending_email_idx
  ON public.support_team_invites (lower(email))
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS support_team_invites_status_idx
  ON public.support_team_invites (status, expires_at);

CREATE TABLE IF NOT EXISTS public.support_team_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email text,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_team_audit_target_idx
  ON public.support_team_audit (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_team_audit_actor_idx
  ON public.support_team_audit (actor_id, created_at DESC);

GRANT SELECT ON public.support_team_members TO authenticated;
GRANT SELECT ON public.support_team_invites TO authenticated;
GRANT SELECT ON public.support_team_audit TO authenticated;
GRANT ALL ON public.support_team_members TO service_role;
GRANT ALL ON public.support_team_invites TO service_role;
GRANT ALL ON public.support_team_audit TO service_role;

ALTER TABLE public.support_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_team_audit ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS support_team_members_updated ON public.support_team_members;
CREATE TRIGGER support_team_members_updated
  BEFORE UPDATE ON public.support_team_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS support_team_invites_updated ON public.support_team_invites;
CREATE TRIGGER support_team_invites_updated
  BEFORE UPDATE ON public.support_team_invites
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.is_support_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = _user_id
       AND role::text = 'admin'
  )
  OR EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.support_team_members stm ON stm.user_id = ur.user_id
     WHERE ur.user_id = _user_id
       AND ur.role::text IN ('support_manager', 'support_agent')
       AND stm.role = ur.role
       AND stm.active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_support_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = _user_id
       AND role::text = 'admin'
  )
  OR EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.support_team_members stm ON stm.user_id = ur.user_id
     WHERE ur.user_id = _user_id
       AND ur.role::text = 'support_manager'
       AND stm.role = ur.role
       AND stm.active = true
  )
$$;

DROP POLICY IF EXISTS "support team members admin read" ON public.support_team_members;
CREATE POLICY "support team members admin read"
  ON public.support_team_members FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "support team invites admin read" ON public.support_team_invites;
CREATE POLICY "support team invites admin read"
  ON public.support_team_invites FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "support team audit admin read" ON public.support_team_audit;
CREATE POLICY "support team audit admin read"
  ON public.support_team_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
