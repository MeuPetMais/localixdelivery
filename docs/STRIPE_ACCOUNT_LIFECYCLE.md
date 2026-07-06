# Stripe Account — Lifecycle

## Estados da conta (`stripe_account_status`)

```text
not_created ──create──▶ onboarding_pending ──details_submitted + charges + payouts──▶ active
      ▲                       │                                       │
      │                       │ requirements.disabled_reason          │
      │                       ▼                                       ▼
   disconnect              restricted ────────── remedy ─────────▶ active
                              │
                              ▼
                       rejected / disabled
```

## Transições

| De | Para | Gatilho |
|---|---|---|
| `not_created` | `onboarding_pending` | `stripe-connect-create` cria account |
| `onboarding_pending` | `active` | Stripe reporta `charges_enabled && payouts_enabled && details_submitted` |
| `onboarding_pending` | `restricted` | `requirements.disabled_reason` presente |
| `active` | `restricted` | Requirements ficam pendentes |
| `restricted` | `active` | Owner completa requirements |
| qualquer | `not_created` | `disconnectAccount` (limpa colunas locais) |

## Fonte de verdade

- Snapshot local em `public.restaurants.stripe_*` (rápido).
- Fonte canônica: API da Stripe (`accounts.retrieve`).
- Sincronização: manual (botão) ou automática (após onboarding).

## Regras de negócio

- **Billing** só considera `ready` quando `status='active'`, `charges_enabled`,
  `payouts_enabled` e `details_submitted` todos verdadeiros.
- Checkout com Stripe **não é impactado** por este milestone.
- `disconnectAccount` não deleta dados na Stripe — apenas remove o vínculo
  local; a conta permanece na dashboard da Stripe.
