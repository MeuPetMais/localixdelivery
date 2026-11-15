-- GATE 4 H2 / somente Supabase isolado gvozcqyjhogmvebrwzap.
-- Colunas conforme estrutura efetiva do Staging 2026-11-14.
-- Sem triggers, políticas, jobs, dados financeiros ou fórmulas novas.
-- Não aplicar esta migration no Staging compartilhado ou Production.
ALTER TABLE public.orders
  ADD COLUMN commission_rate numeric,
  ADD COLUMN loyalty_points_reserved integer DEFAULT 0,
  ADD COLUMN loyalty_points_consumed integer DEFAULT 0;

ALTER TABLE public.restaurants
  ADD COLUMN loyalty_settings jsonb DEFAULT jsonb_build_object(
    'active', false,
    'points_per_real', 1,
    'min_order', 0,
    'min_redeem', 100,
    'max_discount_percent', 30,
    'validity_days', 365,
    'earn_on', 'paid'
  );

COMMENT ON COLUMN public.orders.commission_rate IS
  'Compatibilidade estrutural Gate 4 H2; nenhuma formula ou trigger financeiro habilitado.';
COMMENT ON COLUMN public.orders.loyalty_points_reserved IS
  'Compatibilidade estrutural H2; fidelidade nao habilitada por esta migration.';
COMMENT ON COLUMN public.orders.loyalty_points_consumed IS
  'Compatibilidade estrutural H2; fidelidade nao habilitada por esta migration.';
COMMENT ON COLUMN public.restaurants.loyalty_settings IS
  'Configuracao estrutural H2 com active=false por padrao; ativacao depende de homologacao.';
