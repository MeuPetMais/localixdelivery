# Gate 4B — Alternativa de isolamento: deployment Vercel dedicado (proposta técnica)
Data: 2026-11-16. Status: PREPARADO, NÃO CRIADO. Nenhuma alteração em produção.

## Diagnóstico e reconsideração
A interface Vercel rejeitou a criação de `SUPABASE_SERVICE_ROLE_KEY` com a mesma chave de ambiente já existente para Preview e Production no projeto `localixdelivery-staging`. O aviso de edição anterior informava remoção de Production ao trocar escopo da variável. **Não editar/remover a configuração compartilhada.**

Uma única variável alternativa `GATE4B_SUPABASE_SECRET_KEY` não basta. O código utiliza três cadeias distintas:
- `src/integrations/supabase/client.server.ts`: `process.env.SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (privilegiado).
- `src/integrations/supabase/optional-auth-middleware.ts`: `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` para validar o JWT e derivar `context.userId`.
- `src/integrations/supabase/client.ts`: `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` para login do usuário no browser.
- `src/lib/checkout/OrderService.ts` e `vite.config.ts` possuem guardas fail-closed para a branch de homologação, exigindo `VITE_SUPABASE_PROJECT_ID`, `LOCALIX_ENV=staging`, `MP_ENVIRONMENT=test` e URLs do mesmo projeto.

Alterar o código para suportar aliases em apenas um desses arquivos causaria **desalinhamento entre SSR, middleware e browser**, com risco de erro de autenticação, escrita no banco errado ou exposição de chave administrativa. Um esquema completo de aliases exigiria reavaliar outros consumidores de ambiente, configuração de build Vite e runtime Nitro/Vercel, elevando desnecessariamente o escopo.

## Arquitetura recomendada
**Projeto Vercel novo e exclusivo** para a homologação do Gate 4B (nome sugerido `localix-gate4b-sandbox`), vinculado ao mesmo repositório `MeuPetMais/localixdelivery`, utilizando somente deployments temporários da branch `fix/gate4b-owner-authorization-status`. Não apontar domínio de Production, não usar ambientes dos parceiros reais e exigir proteção de acesso no preview.

Neste projeto exclusivo, usar **nomes de ambiente padrão já previstos no código** e todas as credenciais de `gvozcqyjhogmvebrwzap`:
- `SUPABASE_URL=https://gvozcqyjhogmvebrwzap.supabase.co`
- `VITE_SUPABASE_URL=https://gvozcqyjhogmvebrwzap.supabase.co`
- `VITE_SUPABASE_PROJECT_ID=gvozcqyjhogmvebrwzap`
- `SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY` iguais à chave publicável ativa do isolado.
- `SUPABASE_SERVICE_ROLE_KEY` igual à chave secret `sb_secret_...` do MESMO Supabase isolado, aplicada somente no backend. Nunca criar uma variável `VITE_...` com secret/admin.
- `LOCALIX_ENV=staging`, `MP_ENVIRONMENT=test`.
- Revisar qualquer outra variável relacionada a pagamento, webhook, OAuth e funções remotas. Em caso de dúvida, bloquear o acesso ao gateway até auditoria.
- O build de `vite.config.ts` já impõe a atestação do destino na branch. Aguardar READY e conferir valores permitidos usando logs sem segredos.
- A origem dos valores privilegiados deve ser configurada pelo administrador dentro da própria Vercel; não colar secrets em chat, issues ou commits.

## Condições para criação de infraestrutura
A capacidade de criar novo projeto via integração Vercel pode iniciar deployment automático da branch padrão e usar limites de conta. **Não executar criação/deploy automático sem preparação de variáveis e controle explícito do destino.** Verificar em primeiro lugar alternativa de criar projeto manualmente sem disponibilização pública até haver as chaves.

## Gates
1. Confirmar projeto isolado, branch de deploy, proteção de acesso e combinação completa de credenciais.
2. Com build READY, testar login existente e cadastro+login TEST, sem chamar MP; inspecionar `orders.customer_id` no Supabase isolado.
3. Testar guest offline e recusa guest online, usuários cruzados e replay.
4. Gate financeiro continua NO-GO até autorizações, transações, webhooks, ledger e conciliação comprovados.

**Decisão anterior de usar uma única variável alternativa foi descartada por insuficiência técnica.** Não foi implementada e não há alteração nos três clients Supabase. PR #103 permanece Draft e sem merge.
