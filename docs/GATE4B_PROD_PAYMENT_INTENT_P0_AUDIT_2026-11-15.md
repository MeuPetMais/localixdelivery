# Gate 4B — Auditoria pré-cobrança LIVE: bloqueios críticos de código implantado

**Data:** 2026-11-15
**Fonte:** Edge Function efetivamente implantada em Localix Production `mvkfrwxgneqzvoabkaws`, `mp-payment-intent` versão **13**, `verify_jwt=true`; inspeção somente leitura. Não é uma auditoria completa de exploração dinâmica, nem prova que um ataque tenha ocorrido.

## P0 — Autorização por objeto ausente no handler
- `functions/mp-payment-intent/index.ts`, aproximadamente linhas 401–455: `Deno.serve` lê `action` e `order_id` de `req.json()`, cria cliente administrativo (`SUPABASE_SERVICE_ROLE_KEY`), carrega `orders` pela chave fornecida, carrega `order_payment` e resolve OAuth do restaurante.
- Na função deployada não há leitura explícita de `Authorization` nem verificação `auth.getUser`, `auth.uid`, `order.customer_id`, proprietário do restaurante, papel RBAC ou autorização da ação para aquele pedido.
- `verify_jwt=true` verifica presença/validade de JWT no gateway, **não** prova autorização para operar cada `order_id`. Não se deve concluir exploração, mas a ausência de verificação explícita no handler é uma lacuna severa de controle por objeto.
- O handler dá suporte a `create` (PIX/card), `status`, `refund` e `cancel`, usando o `service_role`; o caminho `refund` (aprox. 1224–1358) chama `POST /v1/payments/{id}/refunds` com OAuth do vendedor e atualiza pedido/pagamento. O escopo de segurança é crítico.
- **Critério de correção:** autenticar JWT com `auth.getUser`; exigir autorização server-side por ação, pedido, dono/operador legítimo, cliente legítimo, estado do pedido e restaurante; não assumir que RLS da tabela protege chamadas com `service_role`. Testes negativos para usuário de outro restaurante, usuário não proprietário, cliente de outro pedido, JWT ausente e acesso anônimo. Rever autorização da ação REFUND exclusivamente a operadores autorizados.

## P0/P1 — Estados MP de reembolso/chargeback mapeados indevidamente
- `mapStatus` na função deployada, aprox. linhas 11–27, trata `refunded` **e** `charged_back` como `APPROVED`.
- `action=status`, aprox. linhas 1189–1222, usa esse `APPROVED` para atualizar `order_payment.status` e invocar `syncOrderStatusFromPayment` (`APPROVED -> pago` em aprox. 368–400). A transição poderá ser rejeitada pelo state machine, mas não é uma guarda adequada para mapear corretamente o fato financeiro.
- **Critério:** mapear REFUNDED e CHARGEBACK como estados distintos, verificar o contrato entre status, tabela, trigger, webhook e ledger. Não executar refund/chargeback real para testes até concluir mocks/reprodução isolados. Idempotência e critérios de não recreditar indispensáveis.

## Controle positivo detectado / ainda insuficiente
- Dois vendedores `connected=true`, `live_mode=true`, token ainda dentro da validade local e escopo `payments`, mas a disponibilidade remota do OAuth não foi testada nesta execução.
- Card transparente usa `order_pricing_snapshot.customer_total`, `platform_fee` e `application_fee`; `POST /v1/payments` com `X-Idempotency-Key` derivada de pedido+token de cartão. PIX usa `order.total`, taxa do snapshot e idempotência determinística por pedido.
- Caminho de preferência Checkout Pro monta item pelo `customer_total` e usa `marketplace_fee`, mas chama `crypto.randomUUID()` no cabeçalho de idempotência (aprox. linha 318): **não determinístico**, observar como possível risco em repetição **caso alcance esse caminho**. No handler atual a rota de preferência aparece depois de um `return` no branch de cartão transparente, portanto a alcançabilidade e uso real precisam ser confirmados antes de propor mudanças nessa rota.
- `order_payment` é pré-gravado em `PENDING` antes de solicitações externas; falhas no gateway podem deixar estado ambíguo. Exigir leitura remota para reconciliar e evitar segundo POST automático.

## Sequência de execução isolada, sem produção
1. Criar correção mínima e testes de autorização por ação/objeto sem relaxar JWT ou expor token.
2. Corrigir e testar mapeamento de `refunded`/`charged_back` com mocks do MP e transições, comprovando nenhum novo crédito.
3. Exercitar cenários negativos: pagamento cancelado, tentativa simultânea, reenvio de webhook, comprador distinto, pedido já pago, falha entre POST e persistência, reembolso duplo, referência/collector divergente.
4. Confirmar build/TypeScript/lint/CI e compatibilidade com código legado (Checkout, pedidos, parceiro, entregador, painéis); validar RLS/RBAC e rollback.
5. Obter aceites técnicos e financeiros; só então **solicitar autorização separada** para teste LIVE de valor limitado.

## Parecer
**NO-GO para cobrança real neste momento.** A alternativa Gate 4B é viável em princípio, mas depende da correção e comprovação dos bloqueios. Nenhum deploy, pagamento, estorno, atualização de ledger ou configuração de secrets foi feito nesta investigação.
