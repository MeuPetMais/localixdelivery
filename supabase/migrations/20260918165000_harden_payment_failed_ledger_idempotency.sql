-- Extend strong Mercado Pago ledger idempotency to PAYMENT_FAILED.
--
-- Historical PAYMENT_FAILED rows are intentionally not rewritten or deleted.
-- The predicate only protects rows written by the idempotent helper, identified
-- by metadata.ledger_idempotency_key. This preserves existing historical
-- duplicates while preventing new duplicates for the same MP payment/type.

DROP INDEX IF EXISTS public.financial_ledger_mp_idempotency_uidx;

CREATE UNIQUE INDEX financial_ledger_mp_idempotency_uidx
  ON public.financial_ledger (provider, reference_type, reference_id, transaction_type)
  WHERE provider = 'mercado_pago'
    AND reference_type IS NOT NULL
    AND reference_id IS NOT NULL
    AND metadata ? 'ledger_idempotency_key'
    AND transaction_type IN (
      'PAYMENT_PENDING',
      'PAYMENT_APPROVED',
      'PAYMENT_FAILED',
      'REFUND',
      'CHARGEBACK'
    );

DROP INDEX IF EXISTS public.financial_ledger_mp_payment_type_idempotency_uk;

CREATE UNIQUE INDEX financial_ledger_mp_payment_type_idempotency_uk
  ON public.financial_ledger ((metadata ->> 'ledger_idempotency_key'))
  WHERE provider = 'mercado_pago'
    AND reference_type = 'mp_payment'
    AND metadata ? 'ledger_idempotency_key'
    AND transaction_type IN ('PAYMENT_PENDING', 'PAYMENT_APPROVED', 'PAYMENT_FAILED');
