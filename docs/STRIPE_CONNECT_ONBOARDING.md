# Stripe Connect — Onboarding

Fluxo end-to-end para conectar um restaurante à Stripe Connect Express.

## Fluxo

```text
Owner ──▶ /pagamentos
   │
   │  clica "Conectar Stripe"
   ▼
StripeService.connect.createExpressAccount(restaurantId)
   │
   ▼
Edge Function `stripe-connect-create`
   │ valida owner_id == auth.uid()
   │ POST /v1/accounts (type=express, country=BR)
   │ persiste stripe_account_id + status=onboarding_pending
   │ POST /v1/account_links (type=account_onboarding)
   │
   ▼
Redirect → Stripe hosted onboarding
   │
   ▼
return_url = /pagamentos?stripe=success
   │
   ▼
StripeService.connect.refreshAccount(restaurantId)
   │ GET /v1/accounts/acct_...
   │ atualiza charges_enabled, payouts_enabled, details_submitted, status, last_sync
   │
   ▼
UI mostra: acct_..., capabilities (Cartão / PIX / Payouts), status
```

## Estados observados

| Situação | `stripe_account_status` | UI |
|---|---|---|
| Ainda não conectou | `not_created` | Botão **Conectar Stripe** |
| Onboarding iniciado, doc pendente | `onboarding_pending` | **Continuar cadastro** + **Sincronizar** |
| Conta ativa (charges + payouts + details) | `active` | Selo verde, **Sincronizar**, **Desconectar** |
| Requirements bloqueadas | `restricted` | Aviso "em análise" + **Continuar cadastro** |
| Rejeitada / desativada | `rejected`/`disabled` | Badge vermelho |

## Sincronização

- Manual: botão **Sincronizar Dados** chama `stripe-connect-refresh`.
- Após retorno do onboarding: refresh automático.
- Nunca confiar apenas no banco — sempre poder consultar Stripe on-demand.
