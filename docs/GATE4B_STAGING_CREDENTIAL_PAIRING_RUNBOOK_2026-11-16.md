# Gate 4B — Credenciais staging: execução segura e bloqueio
Data: 2026-11-16 | Status: parcial / NO-GO

## Verificação concluída
- Supabase isolado `gvozcqyjhogmvebrwzap` com status `ACTIVE_HEALTHY`.
- URL oficial confirmada por `Supabase.get_project_url`: `https://gvozcqyjhogmvebrwzap.supabase.co`.
- `Supabase.get_publishable_keys`: pelo menos uma chave `sb_publishable_...` ativa para este projeto; a chave foi lida no conector, NÃO reproduzida na documentação.
- Vercel `localixdelivery-staging` possui `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `MP_ENVIRONMENT` e `LOCALIX_ENV`; atualmente todas são compartilhadas por preview e production targets do projeto, sem override por branch.
- O build da branch `fix/gate4b-owner-authorization-status` identificou incompatibilidade em quatro valores: `SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `MP_ENVIRONMENT`.
- O conector Supabase deste ambiente não disponibiliza a chave administrativa/secret/service_role do projeto; e o conector Vercel não expõe o valor protegido atual para provar correspondência. **Não foi possível provar que a chave administrativa atual pertence ao Supabase isolado.**
- Por isso nenhuma variável foi alterada nesta execução: mudar só URLs/chave pública sem chave administrativa verificada pode inutilizar o checkout e não satisfaz uma migração segura.

## Mudança correta (somente branch Preview, nunca alvo Production)
No projeto Vercel `localixdelivery-staging`, adicionar um conjunto **branch-scoped** para `fix/gate4b-owner-authorization-status` com:
1. `SUPABASE_URL=https://gvozcqyjhogmvebrwzap.supabase.co`
2. `VITE_SUPABASE_URL=https://gvozcqyjhogmvebrwzap.supabase.co`
3. `VITE_SUPABASE_PROJECT_ID=gvozcqyjhogmvebrwzap`
4. `SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY`: chave pública do **mesmo projeto** fornecida pelo Supabase
5. `SUPABASE_SERVICE_ROLE_KEY`: chave secret/service_role do **mesmo projeto**, obtida pelo responsável via Supabase Dashboard > Project Settings > API Keys; não expor em chat, logs, GitHub ou frontend
6. `MP_ENVIRONMENT=test`, `LOCALIX_ENV=staging`; conferir todos os demais endpoints financeiros para que sejam TEST ou sem chamada externa.

A alteração deve ser atômica do ponto de vista operacional: conferir todas as sete variáveis pareadas, validar escopo Preview/branch, implantar, auditar build de atestação e executar testes sem POST MP. Nunca usar chaves de Production em preview.

## Critérios de saída
- Build do commit exato da branch `READY` e log de atestação sem erro; comprovação adicional read-only do Supabase alvo no runtime.
- Tests E2E com comprador sintético e `orders.customer_id=auth.uid`, sem cobrança MP, somente após comprovar ambiente isolado.
- Gates financeiros, RLS/RBAC, ledger, webhook, idempotência e GO seguem independentes.

**Gate Financeiro NO-GO; PR #103 Draft, sem merge.**
