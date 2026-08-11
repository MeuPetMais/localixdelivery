# MÃ³dulo de Pagamentos â€” Localix

Este mÃ³dulo serÃ¡ o Ãºnico ponto de integraÃ§Ã£o com gateways de pagamento
(Mercado Pago no primeiro momento). EstÃ¡ sendo construÃ­do em etapas:

| Prompt | Escopo |
|--------|--------|
| **1 â€” Infra (atual)** | Migrations, tipos, repositÃ³rios e `PaymentService` vazio. Nada Ã© chamado pelo checkout ainda. |
| 2 | ConexÃ£o OAuth do restaurante com o Mercado Pago. |
| 3 | Painel administrativo de taxas (`platform_fees`). |
| 4 | UI de checkout com resumo financeiro (Pix / CartÃ£o). |
| 5 | CriaÃ§Ã£o real de pagamentos no Mercado Pago (Payment Intent, QR Code). |

## Tabelas

- `mercado_pago_accounts` â€” credenciais OAuth por restaurante.
- `payments` â€” 1 linha por tentativa de pagamento (Pix, cartÃ£o etc.).
- `platform_fees` â€” configuraÃ§Ã£o Ãºnica (singleton) das taxas cobradas.
- `payment_logs` â€” histÃ³rico tÃ©cnico por pagamento.
- `webhook_events` â€” eventos brutos recebidos de gateways (para o Prompt 5+).

## Arquivos

- `types.ts` â€” tipos TypeScript espelhando o schema.
- `repositories.ts` â€” camada fina sobre o client Supabase.
- `PaymentService.ts` â€” orquestraÃ§Ã£o; `calcFees()` jÃ¡ funcional, criaÃ§Ã£o
  de pagamento Ã© placeholder atÃ© o Prompt 5.

## Regras jÃ¡ ativas

- `PaymentService.calcFees(subtotal)` preserva a API legada, mas delega
  o calculo ao `PricingEngine`, que e a fonte unica para taxa, total do
  cliente, receita esperada da plataforma e liquido do restaurante.
- Valores padrÃ£o: pedido mÃ­nimo **R$20**, taxa **R$0,99** atÃ© R$30,
  **R$1,49** acima de R$30.

## SeguranÃ§a

- RLS ativa em todas as tabelas.
- Donos de restaurante sÃ³ enxergam dados do prÃ³prio restaurante.
- `platform_fees` Ã© leitura para autenticados, escrita sÃ³ para `admin`.
- `webhook_events` Ã© leitura sÃ³ para `admin`; escrita apenas via
  `service_role` no backend (Prompt 5).
