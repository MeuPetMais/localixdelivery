# Auditoria — Fluxo de Pagamento Localix

Modo AUDITORIA. Nenhuma alteração de arquitetura ou banco.
Base: leitura do código (`src/lib/payments/**`, `src/lib/checkout/**`,
`supabase/functions/{mp-*, stripe-*}`, `src/routes/$slug.index.tsx`) +
inspeção das tabelas `payments`, `orders`, `payment_webhook_events`,
`order_status_history`.

---

## 1. Fluxo real observado (produção)

```
Cliente → $slug.index.tsx (Sheet Checkout)
       → createOrder (server fn, OrderService)         → orders.status = aguardando_pagamento
       → supabase.functions.invoke("stripe-checkout")  → payments.status = pending (external_id = cs_test_...)
       → redirect para Stripe Checkout (hosted)
       → Stripe → webhook stripe-webhook
                 ├── payments.status = approved
                 ├── financial_ledger insert
                 ├── payment_split insert (se elegível)
                 └── transitionOrder → orders.status = pago
       → Kitchen / Delivery / Tracking seguem via Order Domain
```

Banco confirma: 5 pedidos Stripe percorreram todo o pipeline até `entregue`.
1 pedido (`#1007`) parou em `payments.status=pending` + `orders.status=novo`
desde 2026-07-06 — cliente abandonou o Checkout hospedado (nenhum evento
Stripe chegou).

---

## 2. Divergências entre código e Manifest

### 2.1 Provider Pattern quebrado — Mercado Pago é código morto
- `docs/DOMAIN_MANIFEST_PAYMENT.md` exige que **nenhum consumidor fora do
  Payment Domain** referencie um gateway.
- `src/routes/$slug.index.tsx:1132` chama `stripe-checkout` diretamente.
- `PaymentService.createPayment` (linha ~65 de `PaymentService.ts`) ainda
  lança `"ainda não implementado (Prompt 5)"`.
- `MercadoPagoProvider`, `mp-payment-intent`, `mp-webhook`,
  `PaymentIntentService.create/status/cancel` **não têm consumidor**
  em nenhuma tela (`rg createPaymentIntent src/` → 0 usos).

**Efeito:** o fluxo MP existe, é testável, mas nunca é acionado. A UI
sempre roteia PIX e cartão para `stripe-checkout`.

**Arquivos:** `src/routes/$slug.index.tsx` (1128–1156),
`src/lib/payments/PaymentService.ts` (65–71),
`src/lib/payments/PaymentIntentService.ts`,
`src/lib/payments/providers/MercadoPagoProvider.ts`,
`supabase/functions/mp-payment-intent/index.ts`,
`supabase/functions/mp-webhook/index.ts`.

**Correção mínima (sem mexer em arquitetura):**
mover a invocação para dentro do Payment Domain (uma função servidor
`checkout.startPayment` que decide provider) e expor `PaymentService.
createPayment`. O componente do checkout passa a chamar apenas o Domain.
Enquanto isso, se MP for realmente descontinuado, marcar explicitamente:
remover MP das listas de providers e das Edge Functions.

---

## 3. Bugs de runtime identificados

### 3.1 `stripe-webhook` não transiciona pedido em falhas
`supabase/functions/stripe-webhook/index.ts` — `transitionOrder` só é
chamado quando `mapped.paid === true` (linha ~148). Eventos
`payment_intent.payment_failed`, `payment_intent.canceled` e
`charge.refunded` atualizam `payments.status`, mas **não** movem o
pedido para `falha_pagamento` / `cancelado` / `reembolsado`. Pedido
fica preso em `aguardando_pagamento` indefinidamente.

**Correção:** mapear no `stripe-webhook`:
```
rejected → falha_pagamento
cancelled → falha_pagamento
refunded → reembolsado
```
(mesmo padrão que `mp-webhook` já faz via `domainTarget`).

### 3.2 `mp-webhook` — assinatura opcional (falha de segurança)
`supabase/functions/mp-webhook/index.ts:44`
```
if (!opts.secret) return true; // sem secret configurado: aceita e loga
```
Se `MP_WEBHOOK_SECRET` estiver ausente/renomeado, **qualquer POST é aceito
como legítimo**. `MP_WEBHOOK_SECRET` existe em secrets hoje, mas o
comportamento "fail-open" precisa virar "fail-closed".

**Correção:** retornar `401` quando o secret não estiver definido, ou
condicionar a `Deno.env.get("MP_WEBHOOK_ALLOW_UNSIGNED") === "true"`
apenas em sandbox.

### 3.3 `mp-payment-intent` — email fictício quebra criação de PIX
`supabase/functions/mp-payment-intent/index.ts:150`
```
payerEmail: payload?.payer_email || "cliente@localix.app"
```
Emails inválidos são rejeitados pelo MP e o pagamento nunca é criado
(erro 400 vira `last_error` em `order_payment`). Como PaymentIntentService
não repassa `payerEmail` na maioria dos consumidores, todo PIX MP falha
silenciosamente.

**Correção:** exigir `payer_email` (retornar 400 quando ausente) ou
buscar o e-mail via `customer_profiles`/`orders.customer_email`.

### 3.4 `stripe-checkout` PIX sem `customer_email`
`supabase/functions/stripe-checkout/index.ts:149` só envia
`customer_email` quando existe. Stripe exige e-mail para PIX; sem
ele a API retorna erro 400 e a sessão nunca é criada — o cliente vê
`toast.error("Não foi possível iniciar o pagamento")`.

**Correção:** para `method === "pix"`, exigir `customerEmail` no payload
(retornar 400 se ausente) e coletar o e-mail no formulário de checkout
antes de invocar a função. Cartão pode manter opcional.

### 3.5 `PaymentIntentService.edgeInvoke` usa `supabaseAdmin`
`src/lib/payments/PaymentIntentService.ts:70` invoca a Edge Function com
o cliente admin (service role). Não é necessário — `supabase.functions.
invoke` funciona com o cliente publishable. Uso desnecessário do service
role aumenta a superfície de risco. Correção: usar o cliente
autenticado do request via middleware, não `supabaseAdmin`.

### 3.6 Pedido órfão em `aguardando_pagamento`
Sem cron/job de expiração, um `orders` que chega em
`aguardando_pagamento` mas o cliente abandona o Checkout hospedado fica
preso (exemplo real: `#1007` de 2026-07-06). Não há transição
automática para `falha_pagamento` após expiração da sessão.

**Correção:** worker (pg_cron ou Edge scheduled) que, a cada N minutos,
lista `orders` em `aguardando_pagamento` com `created_at < now() - 60min`
e chama `transitionOrder → falha_pagamento`.

### 3.7 Split + PIX Stripe Connect Express
`stripe-checkout` envia `application_fee_amount` + `transfer_data.
destination` mesmo para `method=pix`. Stripe Connect Express BR
suporta PIX destination charges com restrições. Quando o restaurante
tem Connect ativo E o cliente escolhe PIX, a chance de rejeição
aumenta — verificar em sandbox e, se necessário, desativar split
para PIX (`splitEligible && method !== "pix"`).

### 3.8 `mp-webhook` — comparação de assinatura sensível a formato
`supabase/functions/mp-webhook/index.ts:63` compara `hex.length !==
v1.length`. Como `v1` chega em hex minúsculo (mesma serialização), isso
funciona hoje, mas se o MP mudar para base64 ou hex maiúsculo o webhook
começa a rejeitar tudo silenciosamente. Sugestão: normalizar
`v1.toLowerCase()` antes do XOR.

---

## 4. Onde o pagamento realmente para

| Cenário | Ponto de parada | Sintoma no banco |
|---|---|---|
| Cliente abandona Checkout Stripe | Nenhum webhook chega | `payments.status=pending`, `orders.status=aguardando_pagamento`, sem timeout (3.6) |
| PIX Stripe sem email | 400 do Stripe em `stripe-checkout` | Toast de erro; nenhum `payments` criado (3.4) |
| PIX MP (rota morta) | `mp-payment-intent` recusado por email inválido | `order_payment.last_error` populado (3.3) |
| Pagamento recusado/estornado | `stripe-webhook` atualiza `payments` mas não move `orders` | `payments.status=rejected|refunded`, `orders.status=aguardando_pagamento` (3.1) |
| Webhook MP sem secret configurado | Aceita qualquer POST | risco de estado forjado (3.2) |

---

## 5. Correções sugeridas (sem alterar arquitetura nem banco)

Ordem recomendada:

1. **stripe-webhook** — adicionar `domainTarget` para rejected/cancelled/
   refunded (§3.1).
2. **mp-webhook** — fail-closed quando `MP_WEBHOOK_SECRET` ausente (§3.2)
   e normalizar hex (§3.8).
3. **stripe-checkout** — validar `customerEmail` obrigatório para PIX e
   desligar split para PIX até homologação (§3.4, §3.7).
4. **mp-payment-intent** — exigir `payer_email` real (§3.3).
5. **PaymentIntentService** — parar de usar `supabaseAdmin` (§3.5).
6. **Job de expiração** — pg_cron marcando pedidos em
   `aguardando_pagamento > 60min` como `falha_pagamento` (§3.6).
7. **Payment Domain** — restaurar a fachada única: mover a chamada de
   `stripe-checkout` para dentro de `PaymentService.createPayment` e
   remover a invocação direta no `$slug.index.tsx` (§2.1). Sem essa
   correção o Manifest continua violado, independente dos bugs acima.

---

## 6. Testes propostos

Novos casos (sem substituir os existentes):

- `stripe-webhook.test`: `payment_intent.payment_failed` deve pedir
  `transitionOrder(..., falha_pagamento)`. Reproduz §3.1.
- `mp-webhook.test`: `MP_WEBHOOK_SECRET` ausente → 401. Reproduz §3.2.
- `stripe-checkout.test`: `method="pix"` sem `customerEmail` → 400.
  Reproduz §3.4.
- `mp-payment-intent.test`: `payer_email` inválido → 400 antes de bater
  no MP. Reproduz §3.3.
- `payments.orders.expiration.test`: mockando `now()`, o job de expiração
  transiciona pedidos > 60min em `aguardando_pagamento`. Reproduz §3.6.
- `PaymentService.createPayment.test`: garante que a UI só depende da
  fachada e nunca conhece o provider (§2.1).

---

## 7. Typecheck

Auditoria não altera código; o typecheck vigente permanece verde.
Correções acima cabem em edits pontuais (Edge Functions e uma nova
função servidor), sem impacto nos tipos gerados (`src/integrations/
supabase/types.ts`) e sem necessidade de nova migração.
