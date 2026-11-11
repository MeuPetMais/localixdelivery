# Gate 4 — integridade técnica e limites da aprovação financeira

Issue #90; PR #93, Draft; base de trabalho `ac4e7e599f8f1dc61dd2e018cffe3c28ca36de64`, branch `audit/gate4-complete-financial-statements`. PRs #91 e #92 consultados em Draft, abertos e não mesclados. Histórico completo da issue e dois comentários Codex do PR #93 consultados antes das modificações.

## Diagnóstico e decisões

**P1:** offsets sobre uma tabela que recebe inserções não representam um snapshot. Ordenação e detecção de IDs repetidos não impedem omissões nem tornam duas requisições transacionais. Cursor apenas por `created_at/id` também não exclui inserções retroativas e commits tardios. Portanto, não foi escolhido como garantia contábil.

**P2:** a cardinalidade de uma página depende do limite efetivo do PostgREST. Uma resposta de 100 linhas para uma solicitação de 500 não prova o fim de 1.201 lançamentos.

**Segurança:** `recordLedgerEntry` era uma server function pública sem middleware de autenticação, gravando com `supabaseAdmin`. A busca de chamadores em `src`, Edge Functions e SQL não encontrou invocações desse export. O endpoint e seu validador foram removidos. Os escritores existentes dos webhooks não usam esse endpoint e permanecem intactos. Não foi criada uma alternativa pública para escrever ajustes financeiros. Não se presume conhecer integrações externas não versionadas.

**Fluxo de caixa:** `CHARGEBACK` era negativo no Ledger e ignorado na classificação de saídas do fluxo. Incluído nas saídas, com teste de pagamento, taxa, refund, chargeback e payout parciais. Não houve alteração em `signedAmount`, `computeBalance`, fórmulas de pricing ou split.

## Solução implementada

- A migration **somente preparada para revisão** `20261111204106_gate4_consistent_financial_snapshot.sql` define `get_restaurant_financial_snapshot(uuid)`, `LANGUAGE sql STABLE SECURITY INVOKER`, `search_path=''`. Uma única instrução SQL materializa as linhas visíveis pelas políticas RLS existentes do Ledger. Nenhuma escrita em linhas financeiras, tabela de snapshots, atualização retroativa ou relaxamento de RLS.
- A RPC devolve um **objeto JSONB escalar**, não um conjunto de linhas sujeito ao limite de paginação. Contém versão, restaurante, instante, contagem, completude e lançamentos ordenados. O limite de memória é 50.000 linhas. A consulta lê até 50.001, marca excedentes como incompletos e o aplicativo recusa qualquer agregação. Acima de 10.000 funciona; acima de 50.000 é indisponibilidade explícita, não truncamento aceito.
- Execução anônima revogada; execução concedida a `authenticated`. A função não é `SECURITY DEFINER`, não usa cliente administrativo e não concede acesso novo às tabelas. `auth.uid()` nulo não retorna linhas. As políticas existentes continuam decidindo visibilidade de owner/admin.
- O adaptador valida versão, formato completo das linhas, quantidade declarada versus recebida, IDs, tenant de cada lançamento e moeda única. Duplicatas são uma verificação adicional, não a prova de consistência. Falha de rede, RPC ausente, JSON cortado, schema incompatível ou limite excedido produzem erro, sem fallback para offsets ou soma parcial.
- `getRestaurantFinancialSnapshot` deriva saldo de todos os lançamentos e extrato do período **da mesma resposta**. O port de produção de `FinanceDomain`, o dashboard e o fluxo de caixa usam `getSnapshot`. Os ports antigos de injeção continuam compatíveis; a produção não usa esse fallback. Não há cache compartilhado entre tenants. Widgets consultados em momentos diferentes ainda podem mostrar instantes distintos; não se reivindica snapshot global de toda a página nem de custos/split/reconciliação.
- O extrato de UI limitado a 500 continua distinto de um agregado completo. `getOrderLedger` permanece uma consulta de histórico sujeita ao limite da API e não é fonte destes indicadores; evoluir essa API separadamente antes de prometer histórico ilimitado por pedido.

Fundamentação: [snapshot de instrução no PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html), [funções RPC e valores escalares no PostgREST](https://docs.postgrest.org/en/stable/references/api/functions.html). Uma resposta escalar não divide o extrato em múltiplas requisições HTTP. A garantia depende de instalar a função revisada; não existe fallback silencioso para bancos sem ela.

## Testes e evidências

- `financial-statement-pagination.test.ts`: 0, 501, 1.000, 1.201, 10.001 e 50.000 linhas; resposta artificialmente cortada em 100; contagem inconsistente; limite excedido; IDs ausentes/repetidos; moeda/tenant incompatíveis; intervalos; rede/RPC indisponível.
- `financial-snapshot.sql.test.ts`: PostgreSQL embarcado PGlite, dados exclusivamente sintéticos, migration original de Ledger e suas políticas RLS reais. Instala a nova função **somente na memória do processo de teste**. Valida 12.001 linhas em uma resposta, isolamento owner/tenant, política admin, bloqueio anônimo e escrita direta negada. Uma CTE faz uma inserção retroativa no mesmo comando que lê a função STABLE: o snapshot não inclui a nova linha, e a próxima consulta a inclui. Isso testa MVCC no motor SQL, não é um ensaio de carga com várias sessões HTTP/PostgREST.
- `financial-snapshot.integration.test.ts`: dashboard e fluxo usam exatamente uma leitura; pagamento parcial com identidades distintas conta um pedido; inserção posterior ao retorno não muda apenas o saldo; refund/chargeback/payout parciais; bases mistas continuam bloqueadas; falha da RPC não dispara leitura alternativa.
- `ledger-server-surface.test.ts`: todos os exports de server functions restantes exigem middleware; ausência de writer público, `supabaseAdmin` e `.insert` no serviço de leitura. A negação de escrita por usuário autenticado também é executada no PostgreSQL local.
- Reexecutados testes de caracterização contábil, Ledger, dashboard, fluxo, pricing e split. Nenhuma caracterização equivale a aprovação da regra de negócio.
- Dependência de teste `@electric-sql/pglite` fixada em `0.5.16`; lockfile atualizado e instalação congelada verificada. Não requer banco remoto nem Docker na CI.

### Validação completa

| Verificação local                                                      | Resultado                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `bun install --frozen-lockfile`                                        | PASS, sem alterações adicionais                                                |
| `bun run lint`                                                         | PASS, zero erros e 53 warnings preexistentes                                   |
| `bun run build`                                                        | PASS, código real de saída 0                                                   |
| `bunx tsc --noEmit`, após build                                        | PASS, saída 0                                                                  |
| `bunx vitest run --passWithNoTests --maxWorkers 1 --testTimeout 30000` | PASS, 156 arquivos, 1.325 aprovados e 1 ignorado preexistente; 410,33 segundos |
| Prettier nos arquivos alterados suportados                             | PASS                                                                           |
| `git diff --check` e varredura de segredos/artefatos                   | PASS                                                                           |

Logs locais em `node_modules/.cache/gate4`, ignorados pelo Git. Build usa valores públicos fictícios de Supabase e não executa deploy. Build precede TypeScript para gerar as rotas, conforme a CI. O lint inicialmente apontou uma formatação do tipo de entrada e foi reexecutado integralmente após a correção. Os testes afetados pela última revisão de SQL/tipo foram reexecutados: mais 9 casos PASS. O skip de `driver-wallet.test.ts` depende de `window` e é anterior a este trabalho.

O harness SQL usa as políticas originais do Ledger; `auth.uid` e `has_role` são substitutos locais que representam identidades sintéticas. Não valida emissão real de JWTs Supabase. CI remoto deve ser conferido nos [checks do PR #93](https://github.com/MeuPetMais/localixdelivery/pull/93/checks), para o SHA publicado, antes de qualquer integração.

## Auditoria contábil: bloqueios preservados

| Tema                 | Resultado e pendência                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pedido único         | Contagem por `order_id`; parciais com pagamentos distintos não criam pedidos extras. Ausência de vínculo bloqueia KPI.                                                                                                                           |
| Identidade econômica | IDs de lançamento não equivalem a IDs de pagamento/captura/refund. Duplicatas econômicas com IDs diferentes e igualdade de referências ainda exigem contrato e idempotência atômica dos escritores. Não implementada deduplicação por suposição. |
| Bruto + recebível    | R$ 50 + R$ 48,51 − R$ 1,49 ainda caracteriza R$ 97,02 no núcleo legado; exposição continua bloqueada. Não removido o bloqueio nem escolhida fórmula definitiva.                                                                                  |
| Taxas                | `service_fee_payer`, recebível já líquido e tarifa efetiva de gateway carecem de aceite financeiro. Calculadoras de gateway no PricingEngine ainda retornam zero; snapshot não comprova tarifa real.                                             |
| Saldo                | Saldo contábil, recebível e caixa bancário disponível continuam conceitos distintos. A RPC garante integridade da leitura, não comprova liquidação nem corrige semântica histórica.                                                              |
| Estornos/repasse     | Testados sinais e status existentes, valores parciais e a saída de chargeback. Não demonstrada reconciliação de soma de refunds versus captura em todos os escritores. `payment_split.COMPLETED` não prova sozinho transferência bancária.       |
| Reprocessamento      | Índices MP têm escopo específico. A garantia atômica geral Stripe não está comprovada; não confundir busca antes de insert com unicidade transacional.                                                                                           |
| Multimoeda           | Snapshot de moedas misturadas falha explicitamente; política de consolidação/conversão não foi inventada.                                                                                                                                        |
| Histórico real       | Não lidas nem alteradas linhas financeiras remotas nesta execução. Evidências agregadas anteriores da issue são históricas, não atestado de reconciliação atual.                                                                                 |

## Homologação e integração

1. Revisar contrato SQL, grants, limites de volume/payload/tempo e impacto de leitura de 50.000 lançamentos. Nenhuma migration foi aplicada em staging ou produção nesta execução.
2. Instalar a migration apenas em ambiente de teste aprovado, validar via PostgREST real/JWTs de owner, outro tenant, admin e anônimo, com inserts concorrentes em conexões distintas, backfill e falhas de rede. Conferir schema cache da RPC e timeout. PostgreSQL embarcado não substitui essa homologação.
3. Não publicar aplicação dependente da RPC em banco que ainda não tenha o contrato: haverá indisponibilidade controlada. Não desligar o bloqueio para contornar a migration pendente.
4. Obter aceite do contrato contábil, provar idempotência por gateway, taxas finais, liquidação, calendário, refunds/chargebacks/payouts e reconciliação em sandbox antes de comercializar indicadores como financeiro confiável.
5. Manter PRs #93/#92/#91/#89/#87 em Draft. Nenhum merge, deploy, migration remota, webhook real ou pagamento real autorizado por este relatório.

## Git e parecer

Commit de implementação: `3b0231e8b7ea318c6ad08ae73fef3de9dfeca63b` — snapshot consistente, contratos, segurança do endpoint e regressões. Este relatório é separado em commit de documentação. O PR #93 deve continuar em Draft; a base do PR não foi alterada. Os comentários de revisão não foram marcados como resolvidos sem revisão humana.

| Gate                                       | Parecer                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate 4 técnico, código e validação local   | **PASS** — P1/P2 corrigidos no contrato proposto e testados localmente; instalação/homologação da RPC continua requisito de liberação                     |
| Gate 4 contábil                            | **BLOCK** — contrato de reconhecimento, taxas, recebível, saldo disponível e reconciliação sem aceite                                                     |
| Segurança global para liberação financeira | **BLOCK** — superfície de escrita corrigida e RLS local PASS; falta homologação PostgREST/JWTs reais e comprovação de idempotência por gateway            |
| Prontidão para integração                  | **NÃO APTO** — migration preparada, não instalada/revisada em ambiente de homologação; bloqueios financeiros e dependências dos PRs anteriores permanecem |

O `deno.lock` não rastreado já existia antes desta execução e foi preservado sem inclusão. Arquivo temporário criado pelo CLI foi movido para cache ignorado. Nenhuma alteração na pasta de trabalho original `Localix`; somente metadados compartilhados necessários ao worktree Git. Nenhum merge, deploy, migration remota, pagamento ou webhook real foi executado.

### Arquivos do commit de implementação

- `bun.lock` e `package.json` — dependência fixa de PostgreSQL embarcado para testes.
- `src/integrations/supabase/types.ts` — contrato da nova RPC.
- `src/lib/finance/CashFlowService.ts`, `FinanceDomain.ts`, `FinancialDashboardService.ts` — snapshot único e classificação de chargeback.
- `src/lib/finance/financial-snapshot.integration.test.ts` — regressões de composição, falhas e valores parciais.
- `src/lib/ledger/LedgerService.ts` — RPC de leitura, remoção do writer público e preservação do núcleo contábil.
- `src/lib/ledger/financial-statement-pagination.ts` e `.test.ts` — substituição do paginador inseguro pelo contrato verificável do snapshot.
- `src/lib/ledger/financial-snapshot.sql.test.ts` e `ledger-server-surface.test.ts` — PostgreSQL/RLS e segurança da superfície.
- `supabase/migrations/20261111204106_gate4_consistent_financial_snapshot.sql` — proposta não aplicada.
