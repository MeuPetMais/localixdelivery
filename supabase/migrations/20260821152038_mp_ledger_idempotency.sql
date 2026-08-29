create unique index if not exists financial_ledger_mp_payment_type_idempotency_uk
  on public.financial_ledger ((metadata->>'ledger_idempotency_key'))
  where provider = 'mercado_pago'
    and reference_type = 'mp_payment'
    and transaction_type in ('PAYMENT_PENDING', 'PAYMENT_APPROVED')
    and metadata ? 'ledger_idempotency_key';
