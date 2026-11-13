# Gate 4 — Auditoria read-only da criação e persistência do snapshot financeiro

**Data:** 12/11/2026  
**Ambiente:** Supabase Staging `dnotmvbhuqujvqdtgzav` e revisão de código no PR #96  
**Escopo:** H-02/H-03 — criação de pedido, pagador da taxa, integridade e imutabilidade do snapshot  
**Status:** PASS parcial (estrutura e consistência dos registros atuais); BLOCK (imutabilidade e E2E)

## Evidência de arquitetura

- `src/lib/checkout/OrderService.ts`: `createCheckoutOrder` calcula pricing no servidor e chama RPC `create_order_with_snapshot_payment` com campos `_snapshot_platform_fee` e `_snapshot_service_fee_payer`.
- `supabase/migrations/20260914174138_atomic_checkout_order_creation.sql`: define a RPC para criação atômica de pedido, snapshot e pagamento.
- `supabase/migrations/20260911160337_sync_orders_platform_fee_from_pricing_snapshot.sql`: trigger `AFTER INSERT` atualiza `orders.platform_fee` e `orders.fixed_fee` a partir do snapshot.
- Staging: trigger `trg_sync_order_platform_fee_from_snapshot` presente e definido como `AFTER INSERT`.
- Staging: `authenticated` tem apenas `SELECT` sobre `order_pricing_snapshot` e policy de leitura vinculada ao dono do restaurante; `service_role` tem `INSERT`, `UPDATE`, `DELETE` e outras permissões. Não foi encontrado trigger de bloqueio de `UPDATE/DELETE` na tabela. Isso **não** demonstra exploração ou mutação indevida; demonstra que imutabilidade forte não está comprovada.

## Verificação agregada dos 16 snapshots existentes

Consulta somente leitura, sem expor PII, IDs de pedidos ou informações financeiras individuais:

| Verificação | Observado |
|---|---:|
| Snapshots | 16 |
| `service_fee_payer` nulo ou diferente de `customer`/`restaurant` | 0 |
| `platform_fee` nulo | 0 |
| Subtotal até R$ 30,00 com taxa diferente de R$ 0,99 | 0 |
| Subtotal acima de R$ 30,00 com taxa diferente de R$ 1,49 | 0 |

**Limites:** a comparação usa política comercial atual como referência de auditoria; não prova qual política estava vigente na criação de cada pedido, nem validade do subtotal elegível com descontos, entrega, cashback ou benefícios. Não foi realizado teste de alteração de configuração após criação, nem chamada RPC real com autenticação.

## Riscos e critérios para encerrar

1. **Imutabilidade:** definir se `realized_platform_revenue` pode sofrer atualização legítima posterior, distinguindo campos de pricing congelados de campos de realização. Evitar bloquear alterações legítimas com trigger indiscriminado.
2. **Service role:** auditar todas as rotas, Edge Functions e RPCs com capacidade de alterar ou excluir snapshots; testar operações com JWTs de tenants distintos.
3. **Consistência:** comparar snapshot × pedido × gateway com identificadores sintéticos e extratos sanitizados.
4. **Concorrência:** validar idempotência da RPC de criação e resposta para mesmo `idempotency_key`.
5. **Histórico:** testar políticas efetivamente vigentes no instante do snapshot, sem recálculo retroativo.

**Conclusão:** arquitetura e 16 registros atuais consistentes com os campos inspecionados. **Não foi possível provar** imutabilidade autoritativa do snapshot, E2E do checkout, proteção contra escrita privilegiada indevida ou conciliação com gateway.

**Nenhuma implementação, merge, migration, deploy ou alteração em produção autorizada.** DEC-021 permanece com princípio parcialmente aprovado, Issue #90 aberta e Gate Financeiro NO-GO.
