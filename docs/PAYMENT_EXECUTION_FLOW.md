# Payment Execution Flow — Stripe Sandbox

Fluxo real e ativo da primeira venda Localix em Sandbox.

## Componentes envolvidos (já existentes)

- `orders` — pedido criado por `createCheckoutOrder` (OrderService).
- `payments` — registro do pagamento (linha por Checkout Session Stripe).
- `payment_webhook_events` — idempotência de webhooks
  (`UNIQUE (provider, event_id) WHERE event_id IS NOT NULL`).
- `financial_ledger` — lançamento contábil (`PAYMENT_APPROVED` etc.).
- Edge Function `stripe-checkout` — cria a Checkout Session hospedada.
- Edge Function `stripe-webhook` — recebe e concilia eventos.
- `src/lib/stripe/**` — domínio Stripe (não é chamado pela Edge Function;
  serve como camada de tipos/eventos para o client/servidor Node).

## Sequência

1. Cliente clica em "Pagar com cartão (Stripe)" no checkout do restaurante.
2. Front-end chama `stripe-checkout` com `{ orderId, successUrl, cancelUrl,
   customerEmail? }`.
3. `stripe-checkout` valida sandbox (`sk_test_`), lê `orders` pelo `orderId`,
   cria uma **Checkout Session** (`mode=payment`, moeda BRL, `unit_amount` em
   centavos), passa `metadata.order_id` e `metadata.restaurant_id` também no
   `payment_intent_data.metadata`, insere/upserta linha em `payments`
   (`provider='stripe'`, `external_id=<session.id>`, `status='pending'`) e
   retorna `{ sessionId, url, paymentIntentId }`.
4. Front-end faz `window.location.href = url` (Checkout hospedado da Stripe).
5. Cliente paga (cartão de teste `4242 4242 4242 4242`).
6. Stripe envia `checkout.session.completed` e depois
   `payment_intent.succeeded` para `stripe-webhook`.
7. `stripe-webhook` verifica `Stripe-Signature` (HMAC SHA-256 com
   `STRIPE_WEBHOOK_SECRET_TEST`), aplica idempotência em
   `payment_webhook_events`, localiza `payments` por `external_id` (aceita
   `session.id` OU `payment_intent`), atualiza `status='approved'` e
   `paid_at=now()`, insere `financial_ledger` (idempotente por
   `reference_type='stripe_payment' + reference_id=payment_intent`),
   promove `orders.status='novo'`.
8. Stripe redireciona o cliente para `successUrl` (`/pedido-sucesso/$id`).

## Regras preservadas

- PricingEngine, Loyalty, Billing Domain, OrderService, Analytics e
  Financeiro **não foram alterados**.
- PaymentService continua sendo a fachada; `confirmPayment` foi adicionado
  como no-op idempotente para permitir consumo futuro pelo Payment Domain
  sem quebrar contrato.
- Nenhuma tabela nova; apenas registros novos em tabelas existentes.
- Zero acoplamento: `src/lib/stripe/**` continua isolado; o webhook
  processa direto no banco via service role.

## Variáveis de ambiente (backend)

| Nome                          | Uso                                    |
|-------------------------------|----------------------------------------|
| `STRIPE_SECRET_KEY_TEST`      | `stripe-checkout` (criar Session)      |
| `STRIPE_WEBHOOK_SECRET_TEST`  | `stripe-webhook` (verificar assinatura)|
| `VITE_STRIPE_PUBLISHABLE_KEY_TEST` | Front-end (Elements — próximo passo) |
