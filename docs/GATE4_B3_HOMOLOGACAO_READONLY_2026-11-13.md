# Gate 4 / DEC-021 — B3: evidências somente leitura do Staging
Data: 2026-11-13
Status: B3 PARCIAL — verificação de metadados PASS, homologação financeira E2E NÃO COMPROVADA; Gate Financeiro NO-GO.

## Ambiente e limites
Supabase Localix Delivery - Staging: dnotmvbhuqujvqdtgzav. Foram executadas somente consultas SELECT de metadados e agregados. Nenhuma migration, deploy, escrita de Ledger, fixture, webhook ou pagamento executado. Produção não acessada.

## Evidências observadas
- A RPC public.get_restaurant_financial_snapshot(uuid) existe no Staging (1 assinatura).
- Função SECURITY INVOKER (prosecdef=false), STABLE (provolatile=s), search_path vazio.
- Privilégio EXECUTE para anon: false; para authenticated: true. Privilégio EXECUTE não substitui autorização por registro; RLS exige teste de identidades distintas.
- public.financial_ledger com RLS habilitada e duas policies SELECT para authenticated: admins e donos de restaurante.
- Dois índices de idempotência no Ledger identificados pelo nome; existência não prova cobertura de todas as operações e writers.
- Ledger possui 1 linha, 0 PAYMENT_APPROVED COMPLETED e 0 RESTAURANT_RECEIVABLE COMPLETED. Não é dataset suficiente para atestar reconciliação nem ausência de dupla contagem real.
- A existência da RPC não comprova versão exata da migration, funcionalidade PostgREST/JWT ou concorrência.

## Testes já disponíveis em código/CI
- PR #93: snapshot consistente, PGlite e regressões no commit b15e31c6; CI 4/4 PASS.
- PR #96: testes sintéticos e auditorias no commit 3e32ac14; CI 4/4 PASS.
- PR #97: proteção adicional no snapshot, testada por CI 4/4 no commit ab1bf402, run 43456763360; sem validação E2E.
As aprovações são por branch/commit, NÃO pela cadeia integrada final.

## B3 — lacunas não encerradas
1. Homologação PostgREST com JWT real de owner, terceiro, admin e anônimo; tenant A/B e negação de escrita.
2. Banco isolado com dados sintéticos e migrações equivalentes (branch Supabase Free anteriormente recusada; não escrever no staging compartilhado para substituir).
3. Concorrência multiconexão, webhook duplicado/fora de ordem e chaves econômicas dos writers Mercado Pago.
4. E2E PIX/cartão, pedido/snapshot, taxa customer/restaurant nas fronteiras 29,99/30,00/30,01, Benefits, refunds, chargeback e payout.
5. Conciliação por captura, tarifa efetiva, application_fee, split e comprovante de liquidação externa. Não supor que payment_split COMPLETED comprova transferência.
6. Aceite econômico/contábil integral da DEC-021, que só tem princípio de não duplicidade aprovado; não criar fórmula de saldo por inferência.
7. CI no SHA integrado após dependências e aceite técnico/financeiro para liberação.

## Parecer
PASS limitado para configurações verificáveis de função/RLS/privilégios em Staging.
NÃO FOI POSSÍVEL PROVAR homologação financeira E2E, idempotência completa, reconciliação externa nem prontidão de produção.
B3 permanece ABERTO. Issue #90 ABERTA; Gate Financeiro NO-GO; PRs Draft.
Esta decisão deve atualizar o Documento Mestre quando aprovada e conciliada formalmente.

## B3 — segunda rodada de verificação (13/11/2026)
- Execução local isolada não foi possível neste ambiente: repositório privado não pôde ser clonado por ausência de resolução de rede para github.com; ambiente não dispõe de Bun ou Docker. **Não houve teste PostgreSQL local novo**. A CI prévia dos PRs continua sendo evidência separada, não substitui E2E.
- Staging consultado exclusivamente por SELECT. Migration da função presente no histórico do banco como **20261111212209_gate4_consistent_financial_snapshot**; arquivo versionado no PR #93 tem nome **20261111204106_gate4_consistent_financial_snapshot.sql**. Divergência de identificação exige reconciliar histórico antes de integrar PRs/migrations; NÃO reaplicar SQL automaticamente.
- `pg_get_functiondef` confirma consulta única MATERIALIZED, filtro por restaurant_id e auth.uid, limite 50.001, flag complete, version 1, JSONB escalar, search_path vazio e STABLE. Conteúdo funcional observado é coerente com o arquivo proposto do PR #93, mas **identidade exata do artefato/migration e versionamento ainda não foram comprovados**.
- ACL da RPC contém postgres, service_role e authenticated; anon não tem EXECUTE. Sua invocação com JWTs reais e validação de RLS entre identidades ainda não foi realizada.
- Security advisors do Staging informaram 11 tabelas com RLS sem policies (INFO), 1 função com search_path mutável, extensão pg_net em public, 5 SECURITY DEFINER executáveis por anon, 15 executáveis por authenticated e proteção de senha vazada desabilitada. Estes achados exigem triagem de superfície; **não equivalem automaticamente a exploração ou violação**. Nenhuma correção ou revogação em massa foi feita.
  - https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
  - https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- O Staging possui somente uma branch main no controle de branches consultado; não se criou ambiente isolado nem dados sintéticos.
- Conclusão: B3 NÃO CONCLUÍDO; impedir migrations até reconciliar as versões, homologar com JWTs distintos, conciliação Mercado Pago e testes isolados. Gate Financeiro NO-GO, produção inalterada.
