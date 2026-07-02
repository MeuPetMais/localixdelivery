
CREATE TYPE public.ledger_transaction_type AS ENUM (
  'ORDER_CREATED','PAYMENT_PENDING','PAYMENT_APPROVED','PAYMENT_FAILED',
  'PLATFORM_FEE','GATEWAY_FEE','RESTAURANT_RECEIVABLE',
  'REFUND','CHARGEBACK','PAYOUT','ADJUSTMENT'
);

CREATE TYPE public.ledger_status AS ENUM ('PENDING','COMPLETED','FAILED','CANCELLED');

CREATE TABLE public.financial_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  restaurant_id UUID NULL REFERENCES public.restaurants(id) ON DELETE SET NULL,
  customer_id UUID NULL,
  provider TEXT NULL,
  transaction_type public.ledger_transaction_type NOT NULL,
  reference_type TEXT NULL,
  reference_id TEXT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status public.ledger_status NOT NULL DEFAULT 'PENDING',
  description TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_ledger_order ON public.financial_ledger(order_id);
CREATE INDEX idx_fin_ledger_restaurant ON public.financial_ledger(restaurant_id, created_at DESC);
CREATE INDEX idx_fin_ledger_type ON public.financial_ledger(transaction_type);
CREATE INDEX idx_fin_ledger_status ON public.financial_ledger(status);
CREATE INDEX idx_fin_ledger_reference ON public.financial_ledger(reference_type, reference_id);

GRANT SELECT ON public.financial_ledger TO authenticated;
GRANT ALL ON public.financial_ledger TO service_role;

ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

-- Restaurantes veem apenas seus lançamentos
CREATE POLICY "Restaurant owners read own ledger"
  ON public.financial_ledger FOR SELECT
  TO authenticated
  USING (
    restaurant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.restaurants r
       WHERE r.id = financial_ledger.restaurant_id
         AND r.owner_id = auth.uid()
    )
  );

-- Admins veem tudo
CREATE POLICY "Admins read all ledger"
  ON public.financial_ledger FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Bloqueio de UPDATE/DELETE (append-only). Nenhuma policy = negado para authenticated.
-- service_role bypassa RLS para o LedgerService server-side.

CREATE TRIGGER trg_fin_ledger_updated_at
  BEFORE UPDATE ON public.financial_ledger
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
