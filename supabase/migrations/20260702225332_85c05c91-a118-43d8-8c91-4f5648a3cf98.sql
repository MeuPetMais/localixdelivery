
-- 1) Tabela para PKCE + state (curta duração)
CREATE TABLE IF NOT EXISTS public.oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  code_verifier TEXT NOT NULL,
  redirect_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
-- Sem policies: nenhum acesso via anon/authenticated. Só service_role.

CREATE INDEX IF NOT EXISTS oauth_states_restaurant_idx ON public.oauth_states(restaurant_id);
CREATE INDEX IF NOT EXISTS oauth_states_expires_idx ON public.oauth_states(expires_at);

-- 2) Bloquear acesso direto do frontend a tokens do MP.
--    Tokens nunca devem sair do backend. Todas operações via Edge Function.
DROP POLICY IF EXISTS "Owners manage own MP account" ON public.mercado_pago_accounts;
REVOKE ALL ON public.mercado_pago_accounts FROM authenticated;
REVOKE ALL ON public.mercado_pago_accounts FROM anon;
GRANT ALL ON public.mercado_pago_accounts TO service_role;
