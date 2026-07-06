# Financial Settlement

## Persistência (após `payment_intent.succeeded`)

| Tabela | Chave de idempotência | O que grava |
|---|---|---|
| `payments` | `external_id` (session/PI) | status=approved, paid_at, platform_fee, net_amount |
| `orders` | `id` | status=pago (nunca rebaixa) |
| `financial_ledger` | `(provider, reference_type, reference_id)` | PAYMENT_APPROVED |
| `payment_split` | `(provider, split_reference=PI)` | restaurant_amount, platform_amount, destination |
| `payment_webhook_events` | `(provider, event_id)` | dedup do evento |

## Reconciliação

- `payments.platform_fee` == `payment_split.platform_amount` == `application_fee_amount / 100`.
- `payments.net_amount` == `payment_split.restaurant_amount` == `payments.amount - platform_fee`.
- `financial_ledger.amount` == `payments.amount` (valor bruto do pedido).

## Cenários testados

| Cenário | Comportamento esperado |
|---|---|
| Pedido R$50 aprovado com split | payments.status=approved; split gravado; orders.status=pago |
| Pedido R$100 aprovado com split | idem, valores proporcionais |
| Pedido R$200 aprovado com split | idem |
| Pagamento recusado | payments.status=rejected; sem split; orders inalterado |
| Webhook duplicado | `{ok:true, duplicated:true}`; sem novos inserts |
| Refund | payments.status=refunded (split preservado) |
| Retry (mesma PI, novo event_id) | reprocesso seguro — todas as writes são idempotentes |
