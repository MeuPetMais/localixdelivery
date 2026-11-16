# Gate 4B — Diagnóstico da autorização de checkout (16/11/2026)

**Objetivo:** preservar pedidos de clientes sem login, sem conceder autorização financeira a quem conhece apenas o UUID do pedido.

## Fatos verificados em código
- `src/lib/checkout/OrderService.ts` cria pedido server-side por `createCheckoutOrder` com `optionalSupabaseAuth`, deriva `customer_id` de `context.userId ?? null` e usa RPC transacional `create_order_with_snapshot_payment`. A pricing engine calcula preços e as taxas server-side.
- `src/routes/$slug.index.tsx` suporta checkout sem login. Para pagamentos online, o fluxo antes da correção chamava `createCheckoutOrder` e só **depois** verificava `checkoutUser?.email`, exibindo `Faça login com e-mail para pagar online` e encerrando sem iniciar `PaymentService.createPayment`.
- `PaymentService` delega a `MercadoPagoProvider`, que invoca `mp-payment-intent` via cliente Supabase; envia `order_id` e dados da cobrança, sem autorização independente associada ao ID.
- `optionalSupabaseAuth` obtém `context.userId` exclusivamente de `getRequest().headers.get("authorization")` e `supabase.auth.getClaims(token)`, ou retorna null. **Não foi possível provar** que `useServerFn(createCheckoutOrder)` sempre encaminha o JWT nesse cabeçalho após login; essa ligação requer teste E2E com identidade autorizada.
- Schema da criação atômica usa `_customer_id`, que permite null no checkout; idempotência e snapshot seguem na mesma RPC.

## Fatos verificados no banco PROD (somente leitura)
- Total 118 pedidos: 96 com `customer_id` e 22 sem.
- Pedidos sem `customer_id`: 10 têm método PIX ou cartão online (6 PIX, 4 cartão). **Todos os 10 estão cancelados e nenhum tem `order_payment.payment_id` preenchido**. Não se conclui que nenhuma tentativa externa ocorreu historicamente, mas não há ID de recurso do MP nesses registros.
- Os 22 pedidos sem cliente não provam que pagamento online anônimo seja um fluxo autorizado. Não ocultar a existência dos 10 registros online cancelados.

## Correção em branch Draft (sem deploy)
1. `src/routes/$slug.index.tsx`: antes de chamar o server fn de criação de pedido, exige e-mail do usuário para opção online; segue permitindo opção offline para quem não está logado. Mantém também verificação redundante após a criação.
2. `src/lib/checkout/OrderService.ts`: antes do lookup de itens, pricing e RPC atômica, falha se `paymentDecision.paymentRecordStatus === "PENDING"` e `context.userId` não está presente; erro `online_payment_auth_required`. Pagamentos offline preservados.
3. Testes estáticos de posição das guardas adicionados ao repositório. **Testes ainda não executados na CI** nesta auditoria.

## Verificações pendentes antes de merge
- Executar navegador e rede em staging para comprovar que `createCheckoutOrder` recebe `Authorization: Bearer <JWT DO PRÓPRIO CLIENTE>` para login existente e cadastro + login na hora do checkout; nunca transmitir service_role ao navegador.
- Confirmar que `order.customer_id` persistido corresponde ao usuário autenticado usado pelo endpoint MP. Rejeitar alteração por outro usuário, JWT sem autenticação e acesso a outro pedido.
- Verificar pagamento offline em modo convidado; garantir que pedido online não seja persistido após falha de login, incluindo reenvios, duplo clique e tentativa com e-mail sem sessão.
- Analisar flutuações de sessão, token expirado, claims, SSR, cookies e migração. Revisar RLS/RBAC, transições, webhook e ledger.
- Executar Lint, Typecheck, testes, build e CI remota para SHA final. Não equiparar Vercel build a CI e não assumir sucesso de testes.
- **NO MERGE / NO DEPLOY / NO LIVE PAYMENT** até comprovada identidade no serverFn. Gate Financeiro NO-GO.

## Decisão provisória
Não criar nova capacidade bearer de checkout enquanto o produto exigir login para pagamento online; implantar tal token sem verificar a sua emissão por canal confiável criaria risco adicional. Reconsiderar apenas se negócio aprovar PIX/cartão sem login como requisito explícito.

Esta decisão deverá atualizar o Documento Mestre se houver aprovação para alterar o contrato do checkout.
