-- 1) Unique on order_payment(order_id) — enables upsert onConflict
DELETE FROM public.order_payment op
 WHERE op.ctid <> (SELECT ctid FROM public.order_payment o2
                    WHERE o2.order_id = op.order_id
                    ORDER BY o2.updated_at DESC, o2.created_at DESC LIMIT 1);

ALTER TABLE public.order_payment
  ADD CONSTRAINT order_payment_order_id_key UNIQUE (order_id);

-- 2) Unique partial on payments(provider, external_id) for webhook upserts
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_external_uk
  ON public.payments (provider, external_id)
  WHERE external_id IS NOT NULL;
