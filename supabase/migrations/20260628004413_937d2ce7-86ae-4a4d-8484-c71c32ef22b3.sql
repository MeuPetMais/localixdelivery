
CREATE TABLE IF NOT EXISTS public.owner_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role_title TEXT,
  avatar_url TEXT,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  theme TEXT NOT NULL DEFAULT 'auto',
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  marketing_optin BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_profiles TO authenticated;
GRANT ALL ON public.owner_profiles TO service_role;

ALTER TABLE public.owner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own profile" ON public.owner_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Owner inserts own profile" ON public.owner_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Owner updates own profile" ON public.owner_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Owner deletes own profile" ON public.owner_profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE TRIGGER set_owner_profiles_updated_at
  BEFORE UPDATE ON public.owner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
