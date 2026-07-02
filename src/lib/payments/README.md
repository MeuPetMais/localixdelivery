# Módulo de Pagamentos — Localix

Este módulo será o único ponto de integração com gateways de pagamento
(Mercado Pago no primeiro momento). Está sendo construído em etapas:

| Prompt | Escopo |
|--------|--------|
| **1 — Infra (atual)** | Migrations, tipos, repositórios e `PaymentService` vazio. Nada é chamado pelo checkout ainda. |
| 2 | Conexão OAuth do restaurante com o Mercado Pago. |
| 3 | Painel administrativo de taxas (`platform_fees`). |
| 4 | UI de checkout com resumo financeiro (Pix / Cartão). |
| 5 | Criação real de pagamentos no Mercado Pago (Payment Intent, QR Code). |

## Tabelas

- `mercado_pago_accounts` — credenciais OAuth por restaurante.
- `payments` — 1 linha por tentativa de pagamento (Pix, cartão etc.).
- `platform_fees` — configuração única (singleton) das taxas cobradas.
- `payment_logs` — histórico técnico por pagamento.
- `webhook_events` — eventos brutos recebidos de gateways (para o Prompt 5+).

## Arquivos

- `types.ts` — tipos TypeScript espelhando o schema.
- `repositories.ts` — camada fina sobre o client Supabase.
- `PaymentService.ts` — orquestração; `calcFees()` já funcional, criação
  de pagamento é placeholder até o Prompt 5.

## Regras já ativas

- `PaymentService.calcFees(subtotal)` retorna a taxa da plataforma
  aplicando as regras: até R$30 → `fee_up_to_30`; acima → `fee_above_30`.
- Valores padrão: pedido mínimo **R$20**, taxa **R$0,99** até R$30,
  **R$1,49** acima de R$30.

## Segurança

- RLS ativa em todas as tabelas.
- Donos de restaurante só enxergam dados do próprio restaurante.
- `platform_fees` é leitura para autenticados, escrita só para `admin`.
- `webhook_events` é leitura só para `admin`; escrita apenas via
  `service_role` no backend (Prompt 5).
