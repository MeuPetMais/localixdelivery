# Billing — Arquitetura

```
                +---------------------+
                |   BillingService    |  (fachada única)
                +----------+----------+
                           |
   +-------------+---------+---------+----------------+
   |             |                   |                |
Eligibility  Lifecycle           Onboarding      ServiceFee
Service      Service              Service         Service
                |                   |                |
                +-------- events ---+----------------+
                           |
                    BillingEvents (bus)
```

## Princípios

1. **Puro**: nenhum serviço acessa banco ou rede.
2. **Desacoplado**: consumidores externos assinam via `BillingEvents.on()`.
3. **Substituível**: gateway (Stripe/MP) é responsabilidade do Payment Domain
   e será plugado ao Billing apenas via evento no futuro.
4. **Imutável por regra**: transições inválidas lançam erro — impossível
   colocar um restaurante em `Production` sem passar pelo fluxo oficial.

## Estados

`Draft → PendingVerification → PendingStripe → PendingSetup →
PendingApproval → Production`. Qualquer estado (exceto `Closed`) pode ir
para `Suspended` e `Closed`. `Suspended` volta a `Production`.

## Regras oficiais mapeadas

- BD-003 — taxa de serviço R$0,99 → `ServiceFeeService`.
- BD-008 — mínimo 600 pedidos/mês → `EligibilityService`.
- BD-009 — ticket mínimo R$20 → `EligibilityService`.
