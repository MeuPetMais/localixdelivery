# Gate 4B — Validação dirigida do transporte JWT no Checkout
Data: 2026-11-16
Status: **PASS de inspeção estática / NÃO COMPROVADO em runtime E2E — NO-GO para merge/deploy financeiro**

## Problema demonstrado
- `createCheckoutOrder` usa `optionalSupabaseAuth`, que lê `Authorization` do cabeçalho da requisição e resolve `context.userId` via `supabase.auth.getClaims(token)`.
- A chamada inicial `useServerFn(createCheckoutOrder)` da tela `src/routes/$slug.index.tsx` não fornecia cabeçalho `Authorization` explicitamente. Portanto, a identidade de comprador no contexto da Server Function não era garantida pelo código. Isso é uma lacuna comprovada de integração, **não** uma prova de falha real em toda solicitação histórica.
- O PR #103 já bloqueia pedidos online sem `context.userId` antes do RPC financeiro e restringe `mp-payment-intent` ao usuário do pedido ou proprietário da loja.

## Correção isolada adicionada à branch Draft
- `src/routes/$slug.index.tsx`: depois de login existente ou cadastro seguido de login, chamar `supabase.auth.getSession()`, exigir `session.access_token` e mesma identidade da conta de checkout quando o pagamento for online.
- Passar `headers: { Authorization: `Bearer ${checkoutSession.access_token}` }` para `createCheckoutOrder`, usando opções oficiais da Server Function, sem service_role no navegador.
- Para opção offline e cliente sem login, não adicionar cabeçalho e continuar com `customer_id=null`.
- Adicionados testes de regressão de ordem de execução, autenticação, concordância de identidade, transporte do header, recusa antecipada e suporte a pedidos offline.

## Verificações realizadas
- Inspeção dirigida de cinco arquivos da branch: UI, OrderService, middleware opcional, testes e Edge Function MP.
- Nove verificações de presença e ordenação estática passaram: obtenção de sessão antes de criar pedido, envio explícito do bearer, correspondência de identidade, contexto server-side derivado de claims, guarda financeira antes da RPC, guarda por pedido no endpoint, e preservação offline.
- Documentação oficial TanStack Start confirma `headers` customizados no call-site de Server Functions. Não há necessidade de criar token de checkout novo neste modelo.
- Versão anterior consultada do PR: checks Vercel staging e produção SUCCESS, mas **não** comprovam browser E2E, testes Vitest, Typecheck ou Lint.

## Bloqueio CI: causa encontrada
- `.github/workflows/ci.yml` possui `on.pull_request.branches` limitado a `main` e branches específicas de gate.
- A branch base atual do PR #103 é `fix/gate4-pix-test-payer-validation`, ausente dessa lista.
- Consultas de GitHub Actions para commits do PR retornaram 0 runs; ausência de jobs resulta do filtro de workflow, não de aprovação implícita ou reprovação de testes.
- Não alterar branch-base para disparar CI à força: mudaria escopo/diff da revisão. Antes do GO, executar pipeline real em uma branch-base/ambiente de CI deliberadamente preparado.

## Provas ainda obrigatórias
1. Em staging, um consumidor autenticado existente cria pedido online e o servidor persiste `orders.customer_id = auth.uid`; nenhum pagamento real.
2. Em staging, cadastro+login no próprio checkout → JWT no serverFn → mesmo vínculo `customer_id`.
3. Guest offline cria pedido sem exigência de login.
4. Guest online sem login não cria pedido; JWT vencido, trocado, ausente ou de outro usuário é rejeitado. Verificar reenvio e idempotência.
5. Confirmar JWT do serverFn e JWT do cliente Supabase Functions correspondem à mesma conta nas chamadas financeiras, e que refund/cancel não são autorizados a consumidores.
6. Lint, Typecheck, Vitest, Build e PostgreSQL concurrency com evidência por SHA final; revisão RLS/RBAC e rollback; só depois autorização específica para Live E2E.

**Sem merge, deploy de Edge Function, migration, webhook, reembolso ou cobrança. Gate Financeiro NO-GO.**
