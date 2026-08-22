-- Idempotencia forte para eventos financeiros novos do Mercado Pago que podem
-- chegar com event_ids diferentes representando o mesmo pagamento/refund.
-- O predicado por ledger_idempotency_key evita bloquear o deploy por duplicatas
-- historicas anteriores ao helper idempotente.
CREATE UNIQUE INDEX IF NOT EXISTS financial_ledger_mp_idempotency_uidx
  ON public.financial_ledger (provider, reference_type, reference_id, transaction_type)
  WHERE provider = 'mercado_pago'
    AND reference_type IS NOT NULL
    AND reference_id IS NOT NULL
    AND metadata ? 'ledger_idempotency_key'
    AND transaction_type IN ('PAYMENT_PENDING', 'PAYMENT_APPROVED', 'REFUND', 'CHARGEBACK');
