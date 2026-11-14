# Gate 4 — DEC-021: proposta de base econômica, para aprovação (14/11/2026)

**Status:** PROPOSTA, não aprovada e não implementada. PR #100 Draft. Sem alterações de lógica, schema, dados, merge, deploy ou pagamentos.

## Fatos comprovados no código
- `src/lib/ledger/LedgerService.ts`: `signedAmount` trata `PAYMENT_APPROVED` e `RESTAURANT_RECEIVABLE` com sinal positivo; `computeBalance` sinaliza `ambiguousPostingBasis` quando ambas estão `COMPLETED`.
- `assertUnambiguousFinancialPostingBasis` e `dashboardBalance` bloqueiam exibição de saldo ambíguo; `FinancialDashboardService.assertSingleRevenuePostingBasis` bloqueia KPI com bases misturadas.
- Teste FIN-01 demonstra aritmética legada diagnóstica `R$ 50,00 + R$ 48,51 - R$ 1,49 = R$ 97,02`; **não é saldo disponível ou saldo econômico válido**.
- Teste FIN-06 documenta risco de duplicidade por referência de captura com IDs diferentes; existem guardas de leitura e índices específicos, mas não se deve concluir *exactly once* da cadeia inteira a partir deles.
- DEC-015: taxa de serviço de R$0,99 até R$30, R$1,49 acima; Mercado Pago principal. É indispensável diferenciar valor de produtos, taxa paga pelo cliente, taxa de gateway, comissão, repasse do parceiro e total pago segundo o snapshot do pedido.
- DEC-021: usuário aprovou SOMENTE o princípio de que pagamento bruto e recebível não podem ser contados duas vezes. **Não aprovou fórmula final nem implantação.**

## Opções contábeis para decisão
A. **Recebível como base econômica do parceiro; captura como evidência de liquidação**. Não somar captura novamente no saldo. Exige definir saldo de recebível por estágio e gateway, repasse, estornos e titularidade da taxa.
B. **Captura como base de entrada financeira; recebível como obrigação informativa**, com reconciliação de liquidação/payout. Não somar recebível. Exige separar custódia/conta do intermediador e direito do parceiro.
C. **Subledgers segregados (proposta preferida):** pedido/valor econômico, gateway/captura, obrigação do parceiro e saldo liquidado por contas distintas. Transferências mudam a posição entre contas, sem gerar nova receita. Maior rastreabilidade e esforço de implementação, porém apropriado para split e reembolso. Sem aprovação, manter fail-closed atual.

**Recomendação (não decisão):** validar C como modelo-alvo apenas após conciliar contratos MP/split e confirmar quem paga cada taxa; até lá preservar o bloqueio atual. Avaliar se uma correção isolada por views/relatórios pode resolver a exposição sem reescrever histórico.

## Exemplos de validação sem presumir titularidade do dinheiro
- Pedido com `item_subtotal=R$50,00` e DEC-015: taxa cliente R$1,49, **se** ela for adicional ao subtotal então `customer_total=R$51,49`, antes de entrega/descontos/outras taxas. O próprio snapshot autoritativo deve confirmar esses componentes; não derivar o recebível como `R$50,00 - R$1,49` sem regra comprovada.
- Caso legado `PAYMENT_APPROVED=R$50,00`, `RESTAURANT_RECEIVABLE=R$48,51`, `PLATFORM_FEE=R$1,49`: todos podem registrar fatos distintos, mas não podem compor `R$97,02` de saldo. A classificação econômica, titularidade dos R$1,49 e liquidação são **pendentes de comprovação**.
- Refund e chargeback não podem produzir saldo sem vínculo com pagamento, pedido e reversão econômica correspondente.
- Referência idempotente deve garantir que dois eventos do mesmo capture não gerem dois efeitos econômicos.

## Critérios de aceite antes de mudar o código
1. Confirmar com extrato/sandbox MP e snapshot de preço a composição de `customer_total`, `RESTAURANT_RECEIVABLE`, taxa de serviço, gateway fee e split por pagador.
2. Aprovar explicitamente **qual base** representa: receita do parceiro, valor pago por cliente, saldo do parceiro a receber, disponível, repassado e receita da plataforma.
3. Testar 2 limites de taxa DEC-015 (R$30 / R$30,01), aprovação, recusa, partial failure, webhook duplicado, refund, chargeback, payout e cross-tenant.
4. Só depois especificar mudança mínima server-side, novos testes, validação SQL/RLS, rollout e rollback em ambiente isolado.
5. Só após evidências de integração MP TEST + Supabase isolado e validação contábil emitir GO. Nunca inferir aprovação de merge/deploy.

## Infraestrutura para E2E
- Lista de branches consultada: Supabase Staging `dnotmvbhuqujvqdtgzav` expõe apenas a branch `main` default; Production `mvkfrwxgneqzvoabkaws` não apresentou branches de desenvolvimento. Não foi identificada branch financeira isolada pronta.
- O Staging compartilhado não contém a Edge Function `mp-webhook-retry` integrada ao PR #100.
- Testes de receiver/worker atualmente usam banco/gateway sintéticos; CI com PostgreSQL real testa concorrência sobre **tabelas de fixture**, não a aplicação E2E integral com Supabase e Mercado Pago.
- Ambiente isolado de verdade para E2E é uma **dependência externa objetiva**: criar projeto/branch autorizada com custo declarado, ou stack local com acesso externo controlado e dados fictícios, depois de revisar apenas dependências do runtime financeiro. Nada disso foi criado nesta etapa.

**Parecer:** CI e guardas estão aprovados, mas não foi possível provar GO financeiro. A DEC-021 permanece pendente de escolha contábil e prova de liquidação. Não utilizar o cálculo de R$97,02 como saldo real.
