-- Gate 4 / B1: baseline para teste transacional SOMENTE no Supabase descartável.
-- CANDIDATO PARCIAL, NÃO UMA MIGRATION FINAL. Não executar em Production/Staging.
-- Proveniência: migrations originais 20260624210222, 20260625123909 e
-- checagem read-only das policies finais em Staging (14/11/2026).
-- Abre transação para que a validação possa ser sempre seguida de ROLLBACK.
-- Não inclui cron, pg_net, seeds, triggers de integração ou pagamentos.
BEGIN;

CREATE TYPE public.app_role AS ENUM (
  'admin', 'partner', 'customer', 'financeiro', 'comercial',
  'atendimento', 'marketing', 'analista', 'delivery_driver',
  'support_manager', 'support_agent', 'partner_growth'
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  whatsapp_phone text NOT NULL,
  logo_url text,
  cover_url text,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  min_order numeric(10,2) NOT NULL DEFAULT 0,
  is_open boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  address text,
  payment_method text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'novo',
  order_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Não conceder INSERT público em pedidos: checkout posterior usa RPC/serviço.
REVOKE ALL ON public.user_roles, public.restaurants, public.orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.user_roles, public.restaurants, public.orders TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Conserva semântica original de has_role, mas restringe EXECUTE a papéis esperados.
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated, service_role;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anonymous visitors can view active public restaurants"
ON public.restaurants FOR SELECT TO anon USING (active = true);
CREATE POLICY "Authenticated users can view active public restaurants"
ON public.restaurants FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "Owners can view their restaurant"
ON public.restaurants FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert their restaurant"
ON public.restaurants FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update their restaurant"
ON public.restaurants FOR UPDATE TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete their restaurant"
ON public.restaurants FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Customers view own orders" ON public.orders FOR SELECT TO authenticated
USING (customer_id = auth.uid());
CREATE POLICY "Owners view their orders" ON public.orders FOR SELECT TO authenticated
USING (
 EXISTS (SELECT 1 FROM public.restaurants r
 WHERE r.id = orders.restaurant_id AND r.owner_id = auth.uid())
 OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX idx_restaurants_owner ON public.restaurants(owner_id);
CREATE UNIQUE INDEX orders_restaurant_order_number_uidx ON public.orders(restaurant_id,order_number);

-- As colunas e triggers completos NÃO estão instalados: B1 valida só fundação.
-- Verificação é realizada pelo chamador dentro da transação, antes do ROLLBACK.
SELECT
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
   AND relname IN ('user_roles','restaurants','orders')) AS b1_tables,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public'
   AND tablename IN ('user_roles','restaurants','orders')) AS b1_policies,
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
   AND relname IN ('user_roles','restaurants','orders') AND relrowsecurity) AS b1_rls_tables,
  has_function_privilege('anon','public.has_role(uuid,public.app_role)','EXECUTE') AS anon_has_role_execute,
  has_table_privilege('anon','public.orders','INSERT') AS anon_orders_insert;

ROLLBACK;
