CREATE TABLE IF NOT EXISTS public.partner_growth_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_signal text,
  title text NOT NULL,
  notes text,
  priority text NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE',
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_growth_tasks_source_signal_check CHECK (
    source_signal IS NULL OR source_signal IN (
      'SEM_VENDA_7D',
      'QUEDA_PEDIDOS',
      'CLIENTES_INATIVOS_30D',
      'BOA_EVOLUCAO'
    )
  ),
  CONSTRAINT partner_growth_tasks_priority_check CHECK (
    priority IN ('ALTA', 'MEDIA', 'BAIXA')
  ),
  CONSTRAINT partner_growth_tasks_status_check CHECK (
    status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'DESCARTADA')
  ),
  CONSTRAINT partner_growth_tasks_title_length_check CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 160
  ),
  CONSTRAINT partner_growth_tasks_notes_length_check CHECK (
    notes IS NULL OR char_length(notes) <= 1000
  )
);

CREATE INDEX IF NOT EXISTS partner_growth_tasks_assigned_status_idx
  ON public.partner_growth_tasks (assigned_to, status);

CREATE INDEX IF NOT EXISTS partner_growth_tasks_restaurant_status_idx
  ON public.partner_growth_tasks (restaurant_id, status);

CREATE INDEX IF NOT EXISTS partner_growth_tasks_open_due_idx
  ON public.partner_growth_tasks (due_at)
  WHERE status IN ('PENDENTE', 'EM_ANDAMENTO');

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

DROP TRIGGER IF EXISTS partner_growth_tasks_guard ON public.partner_growth_tasks;
CREATE TRIGGER partner_growth_tasks_guard
  BEFORE UPDATE ON public.partner_growth_tasks
  FOR EACH ROW EXECUTE FUNCTION public.partner_growth_tasks_guard();

ALTER TABLE public.partner_growth_tasks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_growth_tasks TO authenticated;
GRANT ALL ON public.partner_growth_tasks TO service_role;

DROP POLICY IF EXISTS "partner growth tasks own wallet select" ON public.partner_growth_tasks;
CREATE POLICY "partner growth tasks own wallet select"
  ON public.partner_growth_tasks FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    AND private.has_partner_growth_restaurant(restaurant_id)
  );

DROP POLICY IF EXISTS "partner growth tasks own wallet insert" ON public.partner_growth_tasks;
CREATE POLICY "partner growth tasks own wallet insert"
  ON public.partner_growth_tasks FOR INSERT TO authenticated
  WITH CHECK (
    assigned_to = auth.uid()
    AND created_by = auth.uid()
    AND private.has_partner_growth_restaurant(restaurant_id)
  );

DROP POLICY IF EXISTS "partner growth tasks own wallet update" ON public.partner_growth_tasks;
CREATE POLICY "partner growth tasks own wallet update"
  ON public.partner_growth_tasks FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    AND private.has_partner_growth_restaurant(restaurant_id)
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND created_by = auth.uid()
    AND private.has_partner_growth_restaurant(restaurant_id)
  );

DROP POLICY IF EXISTS "partner growth tasks admin manage" ON public.partner_growth_tasks;
CREATE POLICY "partner growth tasks admin manage"
  ON public.partner_growth_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
