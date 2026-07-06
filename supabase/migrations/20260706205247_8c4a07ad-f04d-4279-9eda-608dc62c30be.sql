
CREATE OR REPLACE FUNCTION public.enforce_partner_email_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_provider text;
BEGIN
  SELECT COALESCE(raw_app_meta_data->>'provider','email')
    INTO v_provider
    FROM auth.users
   WHERE id = NEW.owner_id;
  IF v_provider IS NOT NULL AND v_provider <> 'email' THEN
    RAISE EXCEPTION
      'Parceiros devem se cadastrar exclusivamente com e-mail e senha (provider=%).',
      v_provider
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurants_partner_email_only ON public.restaurants;
CREATE TRIGGER trg_restaurants_partner_email_only
BEFORE INSERT ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.enforce_partner_email_only();

CREATE OR REPLACE FUNCTION public.enforce_role_email_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_provider text;
BEGIN
  IF NEW.role IN ('admin','partner') THEN
    SELECT COALESCE(raw_app_meta_data->>'provider','email')
      INTO v_provider
      FROM auth.users
     WHERE id = NEW.user_id;
    IF v_provider IS NOT NULL AND v_provider <> 'email' THEN
      RAISE EXCEPTION
        'Papel % exige autenticação por e-mail/senha (provider=%).',
        NEW.role, v_provider
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_email_only ON public.user_roles;
CREATE TRIGGER trg_user_roles_email_only
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_email_only();
