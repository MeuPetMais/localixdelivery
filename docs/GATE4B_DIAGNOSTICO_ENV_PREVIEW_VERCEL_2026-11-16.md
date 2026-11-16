# Gate 4B — Diagnóstico de isolamento do preview Vercel
Data: 2026-11-16 | Projeto Vercel: `localixdelivery-staging`
**Status: BLOQUEADO / NO-GO para testes que escrevem no banco**

## Evidências auditáveis
A branch de PR `fix/gate4b-owner-authorization-status` ganhou atestação de ambiente em `vite.config.ts`. Durante o build Vercel desta **branch somente**, ela compara os valores efetivos (sem imprimi-los) com:
- `VERCEL_ENV=preview`
- `SUPABASE_URL=https://gvozcqyjhogmvebrwzap.supabase.co`
- `VITE_SUPABASE_URL=https://gvozcqyjhogmvebrwzap.supabase.co`
- `VITE_SUPABASE_PROJECT_ID=gvozcqyjhogmvebrwzap`
- `LOCALIX_ENV=staging`
- `MP_ENVIRONMENT=test`

O deploy `dpl_9uLHA4naduvmeADoCASvShgyEu25`, commit `7449c39`, falhou com `gate4b_preview_environment_attestation_failed` sem revelar valores.
O deploy `dpl_BeiSYK2iqURv3EZV89CTdZNCJ9kf`, commit `72bbda8`, apresentou diagnóstico de **nomes somente**:
`SUPABASE_URL,VITE_SUPABASE_URL,VITE_SUPABASE_PROJECT_ID,MP_ENVIRONMENT`.
`VERCEL_ENV` e `LOCALIX_ENV` satisfizeram os critérios naquela execução.

## Interpretação
A configuração real do staging **não coincide** com o projeto isolado autorizado. Não se pode deduzir se os valores divergentes apontam para Production, outro staging ou estão vazios; apenas a divergência foi comprovada. Sem a prova de pareamento de `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_PUBLISHABLE_KEY` ao projeto isolado, alterar só URLs é inseguro.

## Procedimento de correção — exige credenciais correspondentes e validação de titularidade
1. Abrir o projeto Vercel `localixdelivery-staging` (preview), conferir a origem das variáveis e sua precedência por branch. Não fazer isso no projeto Vercel `localixdelivery`.
2. Conectar o staging **inteiramente** ao Supabase isolado `gvozcqyjhogmvebrwzap`: URLs server e Vite, project ID e chaves publicável/service role obtidas daquele projeto; nunca misturar chaves com o Supabase Production `mvkfrwxgneqzvoabkaws`. Não colar chaves em logs, PR ou chat.
3. Ajustar `MP_ENVIRONMENT=test`; revisar demais variáveis de gateway e endpoints para impedir chamadas LIVE. Não habilitar webhooks/PIX reais por esse ato.
4. Após alterações em *preview* realizar redeploy da branch e exigir build READY somente se a atestação passar; checar execução do runtime via leitura controlada/atestado sem segredos.
5. Só depois executar E2E de login com usuário fictício e criação de pedido de teste sem chamar MP, comparando `orders.customer_id` ao UUID derivado do JWT e confirmando o destino no banco isolado.
6. Executar limpeza apenas de fixtures sintetizados explicitamente identificados e preservar evidências de idempotência e segurança.

## Restrições
Nenhuma alteração de variável Vercel, chave, URL, banco ou ambiente financeiro foi realizada nesta investigação. **Não trocar as URLs sem parear as duas chaves do projeto alvo.**
CI GitHub do commit anterior `215a07a6`: 5/5 PASS; a introdução da atestação de build é posterior e requer nova validação do SHA final.
PR #103 permanece Draft, sem merge nem deploy financeiro no Supabase. Gate Financeiro NO-GO.
