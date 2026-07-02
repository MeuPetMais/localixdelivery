
-- Extend app_role with new future roles (kept inactive for now)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'financeiro') THEN
    ALTER TYPE public.app_role ADD VALUE 'financeiro';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'comercial') THEN
    ALTER TYPE public.app_role ADD VALUE 'comercial';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'atendimento') THEN
    ALTER TYPE public.app_role ADD VALUE 'atendimento';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'marketing') THEN
    ALTER TYPE public.app_role ADD VALUE 'marketing';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'analista') THEN
    ALTER TYPE public.app_role ADD VALUE 'analista';
  END IF;
END $$;

-- Auto-promote the master admin email whenever they sign up
CREATE OR REPLACE FUNCTION public.tg_auto_grant_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF LOWER(NEW.email) = 'financeiro@rngdigital.com.br' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_grant_admin ON auth.users;
CREATE TRIGGER auto_grant_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_grant_admin();

-- Promote now if the user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE LOWER(email) = 'financeiro@rngdigital.com.br'
ON CONFLICT (user_id, role) DO NOTHING;
