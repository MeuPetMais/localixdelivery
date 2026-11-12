# Gate 4 — Rastreabilidade dos triggers e dependências na criação de pedidos

**Data:** 12/11/2026  
**Ambiente:** Staging `dnotmvbhuqujvqdtgzav`  
**Método:** consulta somente leitura de `pg_trigger` e corpos de funções PL/pgSQL. Nenhuma inserção, alteração, exclusão, disparo de webhook ou transação com efeitos colaterais.

## Ordem e dependências observadas

- `orders_snapshot_platform_fees`: `BEFORE INSERT`; atribui `platform_fee` e `fixed_fee` usando `NEW.total <= 30`, diferente da base `subtotal` do PricingEngine.
- `trg_orders_assign_number`: `BEFORE INSERT`; numeração.
- `trg_order_notify_customer_ins`: `AFTER INSERT`; cria notificação quando existe `customer_id`; corpo inspecionado não lê `platform_fee`.
- `trg_orders_loyalty_status`: `AFTER INSERT OR UPDATE OF status`; usa `NEW.total` para pontuação e estorno, não lê diretamente `platform_fee`. A base de fidelidade requer avaliação própria.
- `trg_orders_upsert_customer`: `AFTER INSERT OR UPDATE OF status`; atualiza cadastro e métricas do cliente, sem leitura direta de `platform_fee` no corpo principal; dependência `private.rebuild_customer_order_metrics` ainda não auditada.
- `trg_rewards_enqueue_order_event`: `AFTER INSERT OR UPDATE OF status`; enfileira eventos de conclusão, reembolso, chargeback ou cancelamento se Rewards habilitado; não lê diretamente `platform_fee`.
- `trg_sync_order_platform_fee_from_snapshot`: `AFTER INSERT` em `order_pricing_snapshot`; atualiza `orders.platform_fee` e `orders.fixed_fee` para valor do snapshot.
- Outros triggers de `orders` ligados a atualização de status, estoque e notificações não demonstraram leitura direta da taxa na primeira varredura.

## Conclusões

**Fato:** o trigger inicial calcula taxa com `orders.total` e o PricingEngine calcula com `subtotal`; as fórmulas divergem em cenários conhecidos.

**Fato:** nos 16 pares de registros existentes em staging, 6 possuem `orders.platform_fee=1.46` versus `snapshot.platform_fee=0.99`; `fixed_fee` coincide com snapshot em todos os 16.

**Fato:** funções examinadas de notificação, loyalty e enfileiramento Rewards não leem diretamente `platform_fee` em seus corpos.

**Não foi possível provar:** ausência de efeito indireto via funções dependentes, consumidores assíncronos da fila, gateway, Benefits, triggers em outras tabelas ou código da aplicação. Não foi executada inserção transacional com rollback porque há triggers de notificação, fidelidade, CRM e fila, cujos efeitos externos precisam ser isolados antes de escrever.

## Próxima etapa segura

1. Inspecionar `private.rebuild_customer_order_metrics`, consumidores de Rewards, funções de Benefits e writers de `orders.platform_fee` no banco/código.
2. Preparar fixture sintética com restaurante e cliente de teste, sem credenciais reais, sem pagamentos e sem eventos externos.
3. Validar em ambiente isolado se efeitos colaterais são integralmente transacionais; se não, usar clone de staging ou testes em banco local.
4. Somente após esse isolamento, executar inserção e rollback, conferindo `orders`, snapshot, loyalty, notificações, Rewards e ledger antes/depois.

**Gate Financeiro NO-GO.** Issue #90 aberta; DEC-021 apenas princípio contábil aprovado. Sem implementação, merge, deploy ou produção.
