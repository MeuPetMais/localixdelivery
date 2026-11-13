# Gate Financeiro — Consolidação controlada (2026-11-13)

## Escopo
Branch `integration/gate4-financial-issue90` parte de `fix/gate4-mp-retry-queue-worker` (PR #99). Sua base funcional inclui as mudanças herdadas do PR #98 (rejeição de duplicatas pendentes, sem ACK 200), do PR #99 (worker/receiver, retry, controles e testes), da cadeia PR #96 (testes) e PR #93 (snapshot financeiro). Os dois arquivos específicos do PR #97 foram aplicados integralmente:
- `src/lib/ledger/LedgerService.ts`: `assertUnambiguousFinancialPostingBasis` e `assertNoDuplicateCompletedLedgerReferences` fail-closed; preservado `signedAmount` legado, sem criar fórmula financeira nova.
- `src/lib/finance/gate4-issue90-regression.test.ts`: testes de regressão FIN-01 e FIN-06 integrados à matriz existente.

## Conflitos examinados
- PR #97 modifica somente `.github/workflows/ci.yml`, `LedgerService.ts` e `gate4-issue90-regression.test.ts`. As duas modificações funcionais não tinham edições correspondentes na cadeia PR #99 em relação à base #96; portanto a incorporação dos arquivos de #97 é sem resolução manual de conflitos no conteúdo financeiro.
- `.github/workflows/ci.yml` diverge por motivos de base dos PRs e de homologação dos jobs; o workflow da cadeia PR #99 foi mantido, incluindo teste real de concorrência PostgreSQL. Não foi copiado de #97 para evitar perder esse quinto check.
- Sem alterações em migrations, production, env vars ou SQL remoto nesta consolidação.

## Comportamentos validados anteriormente nas linhas de origem
- PR #97: guarda de bases econômicas incompatíveis no snapshot e referências financeiras repetidas com exceção explícita para diagnóstico legado.
- PR #98/#99: rejeição de duplicata pendente, fila/replay opt-in, controle de lease, testes de pagamento/refund/chargeback, falha parcial e estado de pedido.
- A aprovação isolada das linhas de origem **não** equivale à aprovação da combinação. O SHA consolidado deve passar por CI completa e auditoria técnica antes de homologação.

## Restrições contábeis vigentes
DEC-021: aprovado **somente o princípio** de não contar pagamento bruto e recebível na mesma base. **Não está autorizada nova fórmula, alteração financeira em produção ou merge.** O guard preservado bloqueia exposição de saldo ambíguo, mas não calcula um novo saldo.
Exemplo histórico diagnóstico: R$ 50,00 PAYMENT_APPROVED + R$ 48,51 RESTAURANT_RECEIVABLE − R$ 1,49 PLATFORM_FEE = R$ 97,02 legado incorreto. Não interpretar como saldo real.

## Bloqueios para GO
1. Testar versão integrada com CI 5/5 em SHA final.
2. Conciliação E2E isolada com Supabase real / Mercado Pago sandbox, segurança, RLS, cobranças e split; sem processamento de produção.
3. Aprovação contábil do tratamento DEC-021, reconciliação e prova de não duplicidade.
4. Reconciliar divergência de versões de migration do snapshot staging x repositório antes de migrations e merge.
5. Revisar scheduler, monitoramento, cutover, rollback e evento legado pendente em Staging.
6. Autorizações separadas para merge, implantação, credenciais, execução, e produção.

**Status: NO-GO financeiro — consolidado em branch Draft, sem merge/deploy.**
Esta decisão deve atualizar o Documento Mestre somente após aprovação formal.
