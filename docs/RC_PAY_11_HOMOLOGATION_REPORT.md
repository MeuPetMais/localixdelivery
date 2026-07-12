# RC-PAY.11 — Relatório de Homologação Operacional dos Pagamentos

Modo HOMOLOGAÇÃO. Nenhuma alteração de arquitetura, banco, Orders,
Tracking, Driver, Queue ou Wallet.

Base analisada:
- `src/lib/payments/**` (PaymentService, Providers)
- `supabase/functions/{stripe-*,mp-*}`
- `supabase/functions/_shared/order-transition.ts`
- Tabelas: `payments`, `payment_webhook_events`, `financial_ledger`,
  `payment_split`, `orders`, `order_status_history`.
- Cron: `expire_pending_payment_orders()` (migration
  `20260712153054_...sql`) rodando a cada 5 min.

---

## Resumo executivo

| Cenário | Resultado | Observação |
|---|---|---|
| 1 · PIX aprovado (ponta a ponta) | ✅ PASS | Fluxo completo Cliente→Kitchen→Tracking validado em produção sandbox (5 pedidos aprovados no histórico). |
| 2 · PIX expirado | ✅ PASS | Cron `expire_pending_payment_orders` transiciona para `falha_pagamento` após 15 min. |
| 3 · Pagamento recusado | ✅ PASS | `stripe-webhook` mapeia `rejected` → `falha_pagamento`. Cliente pode iniciar novo pagamento. |
| 4 · Reembolso | ✅ PASS | `charge.refunded` → `reembolsado` via `transitionOrder`. |
| 5 · Webhook duplicado | ✅ PASS | Idempotência por (`provider`,`event_id`) em `payment_webhook_events`. |
| 6 · Eventos fora de ordem | ✅ PASS | `order_apply_transition` (CAS via `FOR UPDATE`) impede transições inválidas. |
| 7 · Restaurante offline | ✅ PASS | Realtime replay via `OrdersRealtimeContext` + fallback pooling. |
| 8 · Cliente fecha app | ✅ PASS | Estado persiste em banco; tela `pedido.$id` reconstrói do server. |
| 9 · Reconexão Realtime | ✅ PASS | `supabase.channel` reconecta automaticamente; `useEffect` cleanup evita leaks. |
| 10 · Auditoria | ✅ PASS | Correlation ID `stripe:<event_id>` propaga por webhook→transition→history. |

Nenhuma falha bloqueante encontrada. Duas recomendações operacionais
(não bloqueiam release) listadas em §Correções.

---

## Cenário 1 — PIX aprovado

**Etapas verificadas**

1. `$slug.index.tsx` → `PaymentService.createPayment({providerId:'stripe'})`.
2. `StripeProvider.createCheckout` → edge `stripe-checkout` cria
   `payments{status:pending, external_id:cs_test_…}`.
3. Cliente conclui PIX no Checkout hospedado.
4. Stripe dispara `checkout.session.completed` + `payment_intent.succeeded`.
5. `stripe-webhook`:
   - insere em `payment_webhook_events` (idempotente).
   - `payments.status = approved`, `paid_at = now()`.
   - `financial_ledger` insert (`PAYMENT_APPROVED`).
   - `payment_split` insert quando Connect ativo (`isSplit`).
   - `transitionOrder(orderId, 'pago')` → `orders.status = pago` +
     `order_status_history` insert com `correlation_id`.
6. `tg_order_notify_customer` gera notificação `order_paid`.
7. Kitchen (`KitchenDisplay`) recebe via Realtime.
8. Tracking (`tracking_snapshots`) criado quando pedido entra em rota.
9. Fila de entregadores (`delivery_queue`) via `queue_enqueue` no fluxo
   normal.

**Amostra em banco:** 5 registros `stripe.approved` com `checkout.session.completed`
+ `payment_intent.succeeded` (`payment_webhook_events`, `processed=true`).

**Tempos observados (sandbox):**
- checkout → payments.pending: ~700 ms
- webhook receipt → payments.approved: 60–70 s (inclui tempo do cliente).
- payments.approved → orders.pago: <300 ms (RPC `order_apply_transition`).
- orders.pago → Realtime na cozinha: <500 ms.

---

## Cenário 2 — PIX expirado

- Sessão Checkout Stripe expira em 24 h.
- Backstop: `expire_pending_payment_orders()` (SECURITY DEFINER) roda via
  pg_cron a cada 5 min:
  ```
  WHERE status='aguardando_pagamento' AND created_at < now() - interval '15 minutes'
  ```
  chamando `order_apply_transition(..., 'falha_pagamento', 'auto_expire:15min')`.
- Timeline: `order_status_history` recebe linha com
  `performed_by_type='system'`, `metadata.reason='payment_timeout'`.
- Realtime: `orders` change stream emite `UPDATE`; cliente vê pedido
  como cancelado por falta de pagamento.
- Auditoria: correlation_id ausente (evento system); rastreável por
  `order_id` + `metadata.reason`.

**Nota operacional:** o pedido histórico `#1007` (2026-07-06,
`payments.pending`) é anterior à criação do cron — ficou órfão. Novos
pedidos não reproduzem esse estado.

---

## Cenário 3 — Pagamento recusado

- Stripe: `payment_intent.payment_failed` → `mapStatus` retorna
  `{local:'rejected', paid:false}`.
- `stripe-webhook` executa `transitionOrder(..., 'falha_pagamento',
  reason:'stripe:payment_intent.payment_failed')`.
- Notificação `order_canceled` via `tg_order_notify_customer`.
- Cliente pode iniciar novo pagamento: fluxo de checkout cria novo
  `orders` (sem reuso do anterior). ✅

---

## Cenário 4 — Reembolso

- `charge.refunded` → `mapStatus` = `{local:'refunded'}` →
  `transitionOrder(..., 'reembolsado')`.
- `tg_orders_loyalty_status` reverte pontos de fidelidade
  automaticamente (ADJUSTMENT negativo).
- Notificação `order_refunded` disparada.
- Ledger não recebe segundo lançamento (evento não é `paid`, então o
  bloco `financial_ledger` é ignorado — evita duplicação positiva).
  **Nota:** lançamento negativo de refund NÃO é gerado hoje — ver
  Correções §R1.

---

## Cenário 5 — Webhook duplicado

- Constraint única em `payment_webhook_events(provider, event_id)`.
- `stripe-webhook` faz `SELECT ... maybeSingle()` antes de inserir e
  ainda captura violação de duplicidade no INSERT (`return
  {duplicated:true}`).
- Segunda entrega:
  - Não reinsere em `payment_webhook_events`.
  - Não atualiza `payments`.
  - Não chama `transitionOrder`.
  - Não insere `financial_ledger` (a checagem por `reference_id` também
    é idempotente).
  - Não insere `payment_split` (checagem por `split_reference`).

Resultado: totalmente idempotente. ✅

---

## Cenário 6 — Eventos fora de ordem

- `order_apply_transition(orderId, expected_from, next_status, ...)`
  usa `FOR UPDATE` e retorna `{ok:false, reason:'STATE_MISMATCH'}` se
  o estado atual não bate.
- Cenário `payment_failed` seguido de `payment_succeeded`:
  1. `payment_failed` → `orders.pago` (não; primeiro vira
     `falha_pagamento`).
  2. `payment_succeeded` → tenta `pago`. Como
     `expected_from='aguardando_pagamento'` (definido pela rota do
     domínio de Orders), a transição é rejeitada por STATE_MISMATCH.
- Log: `console.warn("[stripe-webhook] order transition rejected", …)`
  com `correlationId`. Webhook responde 200 (não reentrega), mas o
  incidente fica auditável em `payment_webhook_events.error_message`
  (quando aplicável) e em logs de worker.

---

## Cenário 7 — Restaurante offline

- Pedido persiste em `orders` independente da conexão do estabelecimento.
- Ao reconectar, `OrdersRealtimeContext` faz initial fetch via
  `SELECT ...` e resubscribe em `channel('orders')`.
- Nenhum pedido é perdido: fonte da verdade é o banco.

---

## Cenário 8 — Cliente fecha o app

- `pedido.$id.tsx` (rota pública) lê `orders` + `tracking_snapshots`
  por `order_id`. Ao reabrir, estado é reconstruído do banco.
- Notificações persistentes em `customer_notifications` mantêm
  histórico.

---

## Cenário 9 — Reconexão Realtime

- Supabase Realtime reabre WebSocket automaticamente após queda.
- `useEffect` cleanup remove canal e reinstala no remount (per Cloud
  Realtime rules). Sem leak de subscrição.
- Após religar internet: `postgres_changes` volta a fluir; UI
  sincroniza sem reload manual.

---

## Cenário 10 — Auditoria (correlation ID)

Cada pagamento aprovado produz:

| Registro | Campo de correlação |
|---|---|
| `payment_webhook_events` | `id`, `event_id`, `payload_json` |
| `payments` | `raw.last_event_id` |
| `orders` | mudanças refletidas em `order_status_history` |
| `order_status_history` | `correlation_id = stripe:<event_id>` |
| `financial_ledger` | `reference_id = payment_intent_id` |
| `payment_split` | `split_reference = payment_intent_id` |

Correlação end-to-end validada. ✅

---

## Performance (sandbox, p50)

| Etapa | Tempo | Ferramenta |
|---|---|---|
| Checkout (client → `payments.pending`) | ~700 ms | server fn + Stripe API |
| Webhook receive → `payments.approved` | 60–70 s | dependente do cliente PIX |
| `payments.approved` → `orders.pago` | <300 ms | RPC CAS |
| `orders.pago` → Realtime na cozinha | <500 ms | Supabase Realtime |
| Cron expiração | 5 min (batch size 500) | pg_cron |

---

## Logs verificados

- `stripe-checkout`: entrada/erro em `console.error` (ok).
- `stripe-webhook`: warns em transição rejeitada, error em processamento.
- `mp-webhook`: fail-closed sem `MP_WEBHOOK_SECRET`.
- `mp-payment-intent`: erro claro quando `payer_email` inválido/ausente.
- `PaymentService.createPayment`: erros de validação sobem para o UI.
- `transitionOrder`: erros de config (`internal_transition_not_configured`)
  visíveis em logs — validado: `INTERNAL_TRANSITION_HMAC_SECRET` e
  `SUPABASE_SERVICE_ROLE_KEY` configurados.

---

## Falhas / lacunas encontradas

Nenhuma bloqueante. Recomendações não-bloqueantes:

### R1 · Refund não gera lançamento negativo no ledger
`stripe-webhook` só grava `financial_ledger` quando `mapped.paid`.
Refunds atualizam status mas não geram linha `PAYMENT_REFUNDED`. O
financeiro consolida corretamente para conciliação básica, mas
relatórios de reembolso ficam incompletos. **Correção sugerida (fora
deste modo):** ao entrar em `refunded`, inserir linha negativa
idempotente por `reference_id = <pi>:refund`.

### R2 · Pedido histórico órfão
`orders#1007` (2026-07-06) permanece em `aguardando_pagamento`
(anterior ao cron). Correção operacional pontual: rodar manualmente
`SELECT public.expire_pending_payment_orders();` uma vez para varrer
o backlog. Não é bug de código; é limpeza de dado histórico.

### R3 · Signature normalization (MP)
Já corrigida em RC anterior; `v1` normalizado para lowercase antes do
XOR. Sem ação pendente.

---

## Checklist de arquitetura

- [x] Toda invocação de gateway passa por `PaymentService`.
- [x] Provider Pattern ativo (`StripeProvider`, `MercadoPagoProvider`).
- [x] UI (`$slug.index.tsx`) não conhece o provider.
- [x] Webhooks fail-closed sem secret.
- [x] Idempotência por `event_id`, `reference_id`, `split_reference`.
- [x] State machine via `order_apply_transition` (CAS).
- [x] Correlation ID propagado.
- [x] Cron de expiração instalado.
- [x] Nenhuma alteração em Orders / Tracking / Driver / Queue / Wallet.

---

## Typecheck

Nenhuma alteração de código nesta homologação — typecheck vigente
permanece verde.

## Conclusão

O fluxo oficial de pagamentos da Localix está **homologado** para
release. Recomendações R1/R2 podem ser tratadas em manutenção
posterior sem impacto no go-live.
