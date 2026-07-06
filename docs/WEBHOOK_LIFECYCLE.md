# Webhook Lifecycle — Stripe

## Endpoint

`POST https://eivajusgigmpatpmsynw.supabase.co/functions/v1/stripe-webhook`

`verify_jwt = false` (webhook público). Segurança via
`Stripe-Signature` HMAC.

## Ciclo de vida de um evento

1. **Recebimento.** Corpo lido como texto bruto (necessário para HMAC).
2. **Verificação de assinatura.** `Stripe-Signature` `t=<ts>,v1=<hex>`
   validado com `STRIPE_WEBHOOK_SECRET_TEST` via `HMAC-SHA256`
   sobre `` `${ts}.${rawBody}` ``. Falha ⇒ `401 invalid_signature`.
3. **Idempotência.** Consulta `payment_webhook_events`
   (`provider='stripe'`, `event_id=<evt.id>`). Se existir ⇒ retorna
   `{ ok, duplicated:true }`. Caso contrário insere. O `UNIQUE (provider,
   event_id) WHERE event_id IS NOT NULL` garante segurança contra corrida.
4. **Roteamento por tipo.**
   - `checkout.session.completed` (paid) / `payment_intent.succeeded`
     ⇒ `payments.status='approved'`, `paid_at=now()`,
     `orders.status='novo'`, ledger `PAYMENT_APPROVED`.
   - `payment_intent.processing` ⇒ `in_process`.
   - `payment_intent.payment_failed` ⇒ `rejected`.
   - `payment_intent.canceled` ⇒ `cancelled`.
   - `charge.refunded` ⇒ `refunded`.
   - Outros ⇒ marcado `processed` com `error_message='ignored: ...'`.
5. **Localização do payment.** `payments.external_id` aceita tanto o
   `checkout.session.id` quanto o `payment_intent.id`. Isso permite
   receber os dois eventos sem duplicar linha.
6. **Ledger idempotente.** Deduplicação por `(provider, reference_type,
   reference_id)` onde `reference_id = payment_intent.id`.
7. **Marcação final.** `processed=true`, `processed_at=now()` em sucesso;
   `processed=false`, `error_message`, `processing_attempts=1` em falha.

## Reprocessamento

Reenviar o evento pelo Dashboard da Stripe: o mesmo `evt.id` bate na
idempotência e retorna `duplicated:true` sem efeito colateral.
