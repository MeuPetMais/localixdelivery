# Stripe Sandbox

## Modo padrão

Todo o Stripe Domain opera exclusivamente em **sandbox** neste milestone.
`assertSandboxOnly(readStripeEnv(env))` é chamado por qualquer Edge
Function futura antes de executar operações reais.

## Variáveis de ambiente esperadas (backend)

| Nome                              | Descrição                                          |
|-----------------------------------|----------------------------------------------------|
| `STRIPE_MODE`                     | `sandbox` (default) \| `live`                      |
| `STRIPE_ALLOW_LIVE`               | `true` para destravar `live` (não usar ainda)      |
| `STRIPE_SECRET_KEY_TEST`          | `sk_test_...` (obrigatório em sandbox)             |
| `STRIPE_PUBLISHABLE_KEY_TEST`     | `pk_test_...`                                      |
| `STRIPE_WEBHOOK_SECRET_TEST`      | `whsec_...`                                        |
| `STRIPE_SECRET_KEY_LIVE`          | `sk_live_...` (futuro)                             |
| `STRIPE_PUBLISHABLE_KEY_LIVE`     | `pk_live_...` (futuro)                             |
| `STRIPE_WEBHOOK_SECRET_LIVE`      | `whsec_...` (futuro)                               |

## Regras

- Nenhuma chave `sk_*` no bundle do cliente — as chamadas reais só
  acontecem em Edge Functions.
- Módulo `env.ts` **não** lê `process.env` no escopo de importação.
- `readStripeEnv(env)` recebe o mapa explícito de env do runtime.
- `assertKeyMatchesMode` valida `sk_test_` para sandbox e `sk_live_`
  para live antes de qualquer request.

## Trava deste milestone

Requisição em modo `live` lança:

```
Stripe: modo live bloqueado neste milestone. Toda a infra opera apenas em sandbox.
```

A trava será removida junto com a auditoria de segurança do próximo
milestone (Edge Functions + Webhooks reais).
