CREATE OR REPLACE FUNCTION public.partner_growth_tasks_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF v_user_id IS NOT NULL THEN
    v_is_admin := public.has_role(v_user_id, 'admin'::public.app_role);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'created_at is immutable';
    END IF;

    IF NOT v_is_admin THEN
      IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
        OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'Forbidden identity change';
      END IF;

      IF NEW.status IS DISTINCT FROM OLD.status
        AND NOT (
          OLD.status = 'PENDENTE'
          AND NEW.status IN ('EM_ANDAMENTO', 'CONCLUIDA', 'DESCARTADA')
        )
        AND NOT (
          OLD.status = 'EM_ANDAMENTO'
          AND NEW.status IN ('CONCLUIDA', 'DESCARTADA')
        ) THEN
        RAISE EXCEPTION 'Invalid task status transition';
      END IF;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON TABLE public.partner_growth_tasks FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.partner_growth_tasks TO authenticated;

REVOKE ALL ON FUNCTION public.partner_growth_tasks_guard() FROM PUBLIC, anon, authenticated, service_role;
