# Release Candidate RC1 — Localix

Data: 2026-07-06

## Escopo congelado
- Nenhuma nova funcionalidade.
- Nenhum novo domínio.
- Nenhuma alteração de regra de negócio.
- Nenhuma alteração arquitetural.

## Domínios incluídos no RC1
- Orders (state machine consolidada — webhook Stripe nunca escreve `novo`).
- Payments (Stripe Checkout + PIX + Cash + MP).
- Stripe Connect Express (onboarding, sync, disconnect).
- Stripe Split automático (application_fee_amount + transfer_data).
- PlatformRevenue Domain (fonte única de fees).
- Billing (PaymentsReadinessService).
- Loyalty (earn/redeem/rollback/expire).
- Marketplace, Kitchen, Delivery, Analytics, Financeiro.

## Critérios de aceite
- [x] Webhook Stripe idempotente.
- [x] Kitchen só recebe pedidos pagos.
- [x] Loyalty com rollback em cancelamento.
- [x] Split calculado dinamicamente via `platform_settings`.
- [x] RLS ativa em todas as tabelas públicas.
- [x] Testes unitários passando em PlatformRevenue, StripeSplit, StripeConnect.

## Itens em 🟡 (não bloqueadores)
1. UI de refund no painel restaurante.
2. Responsividade mobile do painel admin.
3. Alertas proativos de observabilidade.
4. Rate limit generalizado.
5. Conciliação financeira automatizada.

## Status
**RC1 aprovado para soft launch.**
