# Payment Domain — Final Report

## Auditoria de acesso direto às tabelas do domínio

Escopo: `payments`, `payment_split`, `payment_reconciliation`,
`mercado_pago_accounts`, `payment_providers`, `payment_webhook_events`,
`payment_logs`, `payment_event_queue`, `order_payment`,
`tenant_payment_settings`.

### Acessos encontrados FORA de `src/lib/payments/**`
| Arquivo | Tabela | Ação |
|---|---|---|
| `src/lib/checkout/OrderService.ts` | `order_payment` | **REMOVIDO** — agora usa `registerPendingOrderPayment` do domínio. |

### Acessos DENTRO do domínio (mantidos — corretos)
- `src/lib/payments/repositories.ts` — `mercado_pago_accounts`, `payments`, `platform_fees`, `payment_logs`
- `src/lib/payments/split.functions.ts` — `payment_split`
- `src/lib/payments/reconciliation.functions.ts` — `payment_reconciliation`
- `src/lib/payments/webhooks.functions.ts` — `payment_webhook_events`

Nenhum outro módulo (Financeiro, Admin, Analytics, Relatórios, Operations
Center, Marketing, AI Platform) acessa tabelas de pagamentos diretamente.

## Referências a gateways fora do domínio
Somente strings de UI ou regras de negócio nomeadas (não código de integração):
- `src/routes/_authenticated/pagamentos.tsx` — tela oficial de conexão (permitido).
- `src/components/finance/PaymentGatewayCard.tsx` — card do dashboard financeiro (permitido — reusa `PaymentService`).
- `src/lib/business/rules/payment-rules.ts` — regra de negócio "Conta Mercado Pago conectada" (label; validação vai via serviço).
- `src/lib/tenant/TenantConfigurationValidator.ts` — whitelist de identificadores permitidos.

Nenhuma integração direta com SDK de gateway em módulos fora do domínio.

## Módulos ajustados
- `src/lib/checkout/OrderService.ts` — consome o facade do domínio.

## Novos artefatos
- `src/lib/payments/orderPayment.server.ts` — facade server-only do domínio para writes de checkout.
- `DOMAIN_MANIFEST_PAYMENT.md`
- `PAYMENT_DOMAIN_FINAL_REPORT.md`

## Serviços reutilizados
- `PaymentService` (browser) — Financeiro, Central Financeira, `/pagamentos`.
- `providers/*` — encapsulados; nenhum consumidor externo.
- `PricingEngine` — inalterado, continua usado por `OrderService`.

## Dependências eliminadas
- Import direto de `order_payment` fora do domínio.
- Menção ao provider (`"mercado_pago"`) no insert do checkout — agora default do facade.

## Confirmação
✅ `PaymentService` (browser) + `orderPayment.server` (server writes) formam
a **única porta de entrada** do Payment Domain.
✅ Nenhum módulo fora de `src/lib/payments/**` faz `.from()` em tabela de
pagamentos.
✅ Provider Pattern intacto — nenhum consumidor externo referencia gateway
por nome no código de integração.
✅ Existe apenas UM fluxo OAuth (em `/pagamentos`, via `PaymentService.connect`).
