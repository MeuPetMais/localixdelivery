# Gate 4B — Revisão do checkout sem login e CI do PR #103

Data: 16/11/2026. Revisão somente leitura de Supabase Production e GitHub.

## Evidência de comportamento
- `orders.customer_id` é FK para `auth.users.id` com `ON DELETE SET NULL`.
- Na base de produção consultada: 118 pedidos; 96 com `customer_id` preenchido, **22 com `customer_id IS NULL`**. Não há pedidos novos no recorte de 30 dias apresentado pela consulta; isso não comprova se a experiência pública atual está ativa ou qual é o caminho exato no frontend.
- Não foi identificada coluna de token de checkout/sessão entre as colunas de tabelas de pedidos/checkout/cliente pesquisadas. **Não foi possível provar** que já exista autorização segura reutilizável para usuário sem login.
- PR #103 exige `auth.getUser` e `orders.customer_id === user.id` ou `restaurants.owner_id === user.id` para `create/status`. Assim, um pedido sem `customer_id` não é pagável pelo comprador anônimo por essa rota se a branch for implantada.
- Não adotar `order_id`, telefone, e-mail do pedido, query string pública ou JWT anon key como prova de titularidade de pagamento.

## Segurança da alternativa
Preferência: capacidade de checkout **opaca, vinculada a um único pedido e ao tipo de ação**, emitida pelo servidor confiável **após** a criação do pedido e a validação de contexto/autorização. Armazenar só hash server-side, TTL curto, rota de emissão autenticada pelo contexto de pedido, consumo limitado, revogação e proteção contra duplicidade. Não retornar token em logs, URLs públicas ou webhooks. Recomenda-se evitar reutilização de tokens em refunds/cancel; tais ações permanecem RBAC proprietário/administrador autorizado. Modelo exato requer localizar o código de checkout, OrderService, criação de pedidos e guardas existentes antes de migrations.
**Não implementar essa alternativa sem contrato de checkout comprovado**: emitir bearer para qualquer visitante que saiba order_id seria uma vulnerabilidade.

## Verificação CI
- Commit inspecionado do PR #103: `054fd698cda2e956092709b3fa2105ced33ec203`.
- Status GitHub combinado: `Vercel – localixdelivery-staging = success`, `Vercel – localixdelivery = success`.
- Consulta de workflow runs para o mesmo commit retornou zero jobs. **Lint, Typecheck, Tests e Build de CI completa não puderam ser comprovados**. Status Vercel não substitui homologação financeira nem execução de teste unitário verificada.

## Consistência financeira
- `mp-webhook` production possui mapeamento distinto `REFUNDED` e `CHARGEBACK` e trilhas de ledger específicas para reversões. PR #103 alinha a função `mp-payment-intent` quanto ao mapeamento.
- A atualização de `order_payment.status` na ação de polling `status` não demonstra por si só ledger/reconciliação final. Não considerar essa mudança fechamento do fluxo de estorno/chargeback.
- Necessário testar no ambiente isolado o fluxo de estado entre webhook, OrderService/RPC de transição e registro no ledger. Sem chamadas de reembolso ou pagamento real nesta fase.

## Gate/ações
1. **PR #103 permanece Draft, NO MERGE / NO DEPLOY.**
2. Revisar fluxo de checkout real e mecanismo seguro de autorização de pedidos anônimos, antes de permitir uso de capacidades.
3. Consolidar testes (incluindo compradores anônimos, negação de acesso cruzado, refund por cliente, reenvio de webhook, mapeamento de reversões); executar CI de verdade.
4. Preservar Gate Financeiro **NO-GO** até prova financeira E2E, idempotência, reconciliação e decisão formal.

Sem alterações em produção, dados financeiros ou variáveis de ambiente nesta verificação.
