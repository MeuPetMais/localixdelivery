# Gate 4 — Fase A: evidência de homologação simulada (14/11/2026)

**Escopo concluído:** validação dos testes automatizados existentes da versão integrada do PR #100. **Não é** homologação financeira externa com Mercado Pago TEST/Supabase real.

## Evidência reproduzível do GitHub
- PR #100, commit `3a56abd274ced101805ffe3c9a24feeb8ad652a1`.
- GitHub Actions CI `43599988696` (https://github.com/MeuPetMais/localixdelivery/actions/runs/43599988696) **5/5 PASS**: Build, Tests, PostgreSQL concurrency, Lint, Typecheck.
- Job Tests `132462495234` executou `bunx vitest run --passWithNoTests` e finalizou com **167 test files passed**.
- Logs do job exibem a execução de `supabase/functions/mp-webhook-retry/financial-flow.integration.test.ts` com cenários do receiver real sob adaptadores simulados: pagamento aprovado, reentrega idempotente, refund, chargeback, falha de persistência em `order_payment`/`payments`, falha de conclusão de evento, transição de pedido rejeitada e incompatibilidade de valor.
- `supabase/functions/mp-webhook-retry/worker-handler.integration.test.ts` exercita o corpo do worker com adaptadores sintéticos, incluindo recuperação de ticket, retry, chamada sem autorização e cutover histórico.
- `src/lib/finance/gate4-issue90-regression.test.ts` caracteriza guardas para base econômica ambígua, duplicidade de referência de captura, segregação por tenant e tratamento de estados não completos.
- Job PostgreSQL concurrency `132462495253` executa `scripts/gate4-postgres-concurrency.sh`: **PostgreSQL real com tabelas sintéticas, não schemas/Edge Functions de um Supabase completo**.

## Classificação e limites
| Subprova | Estado |
| --- | --- |
| CI funcional/estática no SHA integrado | PASS |
| Fluxos simulados de receiver/worker | PASS como parte da suíte 167/167 |
| Concorrência sobre PostgreSQL real sintético | PASS |
| Aplicação completa das migrations Localix num Supabase isolado | NÃO EXECUTADA |
| RLS de ponta a ponta com tokens e contextos reais | NÃO COMPROVADA |
| Mercado Pago TEST com OAuth vendedor, API real, webhook externo e split | NÃO EXECUTADO |
| Conciliação DEC-021 definitiva | NÃO APROVADA |
| Plano de cutover/rollback de produção e autorização de deploy | NÃO APROVADO |

## Desfecho da Fase A
**PASS LIMITADO ao subconjunto automatizado/simulado existente.** Não é autorização para afirmar que toda cadeia financeira está homologada. Não houve alterações financeiras de código, banco, migrations, segredos, ambiente, contas ou gateway.

**Próxima dependência real para Fase B:** prover ambiente financeiro isolado e aprovado com credenciais MP TEST e endpoint de webhook TEST separado; não usar Production nem Staging compartilhado. DEC-021 conceitual C aprovada; fórmula final e conciliação ainda pendentes.

**Gate Financeiro geral: NO-GO. PR #100 Draft, sem merge ou deploy.**
