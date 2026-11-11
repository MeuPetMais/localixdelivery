# Gate 4 — contrato de interpretação financeira (PROPOSTA / NÃO APROVADO)

**Referência:** issue #90; análise do código em `15d2365542b76e3ffdd394a8779e5174651421c5`. Este documento é uma especificação de auditoria, **não** uma autorização para alterar cálculo, ledger histórico, gateway ou produção.

## Evidência observada até 11/11/2026

- No código, `signedAmount` soma `PAYMENT_APPROVED` e `RESTAURANT_RECEIVABLE` como positivos. Se ambos representarem fases do mesmo pagamento, a soma pode duplicar o saldo. O teste sintético 50 + 48,51 − 1,49 reproduz **R$ 97,02**.
- `dashboardBalance` bloqueia exposição de saldo quando há ambos os tipos `COMPLETED` no mesmo restaurante, inclusive em pedidos distintos; manter esse comportamento até revisão financeira.
- `FinancialDashboardService` e `CashFlowService` classificam ambos os tipos como entrada/receita; revisar os indicadores separadamente, não apenas o `netBalance`.
- Migrations e metadados de funções/triggers de staging e produção não identificaram produtor SQL de `RESTAURANT_RECEIVABLE`. Nos agregados consultados: **produção** 17 `PAYMENT_APPROVED/COMPLETED`, 18 `PAYMENT_FAILED/FAILED`, 32 `PAYMENT_PENDING/PENDING`; **staging** 1 `PAYMENT_PENDING/PENDING`. Nenhum `RESTAURANT_RECEIVABLE` nos ambientes nesse instante. As consultas não provam ausência em fontes externas ou histórico futuro.
- Edge Functions `mp-webhook` ativas com mesmo hash de implantação em staging e produção. `stripe-webhook` não aparece como Edge Function ativa nesses projetos. O código Stripe no GitHub não confirma execução implantada.
- `payment_split` e `payment_reconciliation` são registros separados; a rotina administrativa de conciliação lê pagamentos armazenados, não comprova consulta bancária em tempo real.

## Glossário proposto — valores distintos, sem regra definitiva de contabilização

| Conceito | Significado a validar | Evidência operacional necessária |
|---|---|---|
| Total cobrado do cliente | Valor bruto cobrado pelo gateway; pode incluir taxa de serviço conforme quem paga | `order_pricing_snapshot.customer_total`, pagamento gateway e política de pagador |
| Receita da plataforma | Taxa/participação econômica do Localix, não necessariamente caixa recebido | `platform_revenue`, `service_fee_payer`, split, estornos |
| Valor devido ao restaurante | Obrigação líquida segundo contrato de taxas e taxas do gateway | `restaurant_net`, `payment_split.restaurant_amount`, conciliação |
| Recebível | Direito a receber, diferente de liquidação/cash available | data de liquidação e extrato de gateway |
| Repasses realizados | Transferência liquidada; não confundir com split planejado ou `PROCESSING` | ID do payout e confirmação gateway |
| Saldo disponível | Valor comprovadamente liquidado, líquido de bloqueios, chargebacks e saídas | extrato/settlement gateway, reconciliação e calendário |
| Faturamento/pedidos | Métrica comercial por pedido válido, não contagem de lançamentos do Ledger | pedido e snapshot; unicidade por pedido |

## Invariantes exigidos antes de implementar fórmula

1. Um pagamento econômico não pode ser contado duas vezes pela coexistência de `PAYMENT_APPROVED` e `RESTAURANT_RECEIVABLE`. Não presumir que todos os eventos desses tipos sejam o mesmo fato: reconciliar por identidade e fonte.
2. Lançamentos de outro restaurante, status `PENDING/FAILED/CANCELLED` ou outra moeda não podem contaminar o saldo disponível.
3. `REFUND` e `CHARGEBACK` devem usar identidades próprias; reprocessamentos não podem resultar em duplicidade. `PAYOUT` só diminui valor a repassar quando efetivamente confirmado.
4. `PLATFORM_FEE` e `GATEWAY_FEE` não devem ser subtraídos duas vezes de um recebível que já seja líquido dessas taxas. O papel de `service_fee_payer` altera a interpretação da taxa.
5. A soma por `transaction_type` não prova fluxo de caixa; `orders` deve contar pedidos únicos, não eventos financeiros.
6. Nunca converter um resultado ambíguo em zero ou em saldo supostamente disponível. Aplicar erro controlado e mensagem segura, sem alteração retroativa do ledger.

## Matriz de cenários sintéticos (não representa valores bancários observados)

| Cenário | Dado de entrada | Expectativa de segurança | Estado |
|---|---|---|---|
| A — bruto + taxa | 50 pagamento, 1,49 plataforma | Cálculo histórico: 48,51; não prova liquidação | Teste de caracterização |
| B — bases mistas | A + 48,51 recebível | Histórico: 97,02; **dashboard deve bloquear** | Teste de regressão |
| C — outra loja | Recebível de loja B; pagamento da loja A | Sem mistura entre tenants | Teste de regressão |
| D — status | Pagamento `FAILED` ou `PENDING` | Não integra `netBalance` | Teste de regressão |
| E — estorno | A + refund de 10 | Caracterizar sinais; só saldo disponível após conciliação | Teste de caracterização |
| F — payout | A + payout de 20 | Caracterizar sinais; confirmar liquidação fora do teste | Teste de caracterização |
| G — pedidos distintos | Pagamento pedido 1 + recebível pedido 2 | Bloqueio conservador atual; desenho definitivo depende de contrato | Teste de regressão |
| H — multimoeda | BRL e moeda diferente | **Não existe consolidação segura comprovada** | Pendente: definir política e teste de falha fechada |
| I — gateway duplicado | Mesmo evento entregue mais de uma vez | Unicidade atômica por identidade do fato financeiro | Pendente: garantir Stripe e demais fontes |
| J — partial refund/chargeback | Estornos parciais e chargebacks | Sem exceder pagamento e sem duplicidade | Pendente: fixtures integradas |

## Decisões bloqueadas

**Não** alterar `signedAmount`/`computeBalance`, remover `dashboardBalance`, deduzir saldo do snapshot, executar migração em `financial_ledger`, atualizar dados históricos ou considerar um split `COMPLETED` equivalente a repasse bancário sem prova. Os casos E/F são testes de **comportamento existente**, não aprovação de regras de negócio.

## Próximos critérios de aceite

- Aprovar contrato de fato gerador e identidade por gateway, pagamento, pedido, taxa e payout, com especialista financeiro/contábil.
- Conferir fonte e atualização dos dados do gateway, inclusive reembolsos, chargeback, taxas, split e `service_fee_payer`.
- Especificar saldo **contábil**, **a receber** e **disponível** separadamente, por moeda e restaurante.
- Cobrir invariantes com testes sintéticos em CI e testes controlados de integração. Só então alterar fórmula, em PR próprio, mantendo ledger append-only e autorização prévia para qualquer deploy.
