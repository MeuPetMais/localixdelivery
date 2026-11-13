# Gate 4 — Dependências, Benefits e plano de fixture isolada

**Data:** 12/11/2026  
**Ambiente:** Supabase Staging `dnotmvbhuqujvqdtgzav`  
**Execução:** SQL somente leitura, sem DML, chamadas de processamento, webhooks ou pagamentos.

## Evidências adicionais

- `private.rebuild_customer_order_metrics` (`SECURITY DEFINER`): calcula `total_orders`, `total_spent`, `avg_ticket` e `last_order_at` para pedidos entregues/concluídos, somando `orders.total`. Não lê `platform_fee` diretamente. Validar definição de receita/GMV versus faturamento de parceiro.
- `public.rewards_process_completed_order` (`SECURITY DEFINER`): exige pedido concluído e perfil de cliente; qualifica programas por `orders.total >= reward_programs.min_order_amount`; pode chamar `public.benefits_grant` e emitir créditos de benefício.
- `public.rewards_process_order_event_queue` (`SECURITY DEFINER`): consome `PENDING/FAILED` com `FOR UPDATE SKIP LOCKED`, processa/reverte Rewards e atualiza status da fila.
- ACL das três funções `rewards_process_completed_order`, `rewards_process_order_event_queue` e `benefits_grant`: `EXECUTE` limitado a `postgres` e `service_role` no Staging.
- Consulta read-only: **0** eventos `PENDING/FAILED` na fila no momento da auditoria.
- Efeitos dos triggers `orders`: notificação ao cliente, fidelidade, atualização CRM, enfileiramento de Rewards; não é seguro supor ausência de consumidores externos ou workers.

## Plano de teste isolado

### Fase A — criação sem conclusão
- Preferir clone isolado do Staging ou banco local restaurado com dados sintéticos.
- Fixture com restaurante ativo, catálogo sintético e usuário sintético, sem credenciais de gateway reais; nenhum worker externo ou Realtime consumidor conectado.
- Casos: subtotal 29,99; 30,00; 30,01, pagador cliente/restaurante, com/sem entrega.
- Executar fluxo real OrderService → RPC → triggers; comparar `orders.platform_fee`, `orders.fixed_fee`, `order_pricing_snapshot.platform_fee`, ledger e registros colaterais antes de rollback.
- Confirmar rollback e ausência de resíduos após execução.

### Fase B — conclusão, Rewards e Benefits
- Somente em clone isolado, sem webhooks nem workers externos, simular transições autorizadas e processamento de Rewards.
- Verificar idempotência de eventos e créditos, política de mínimo, cashback, estornos, chargebacks e consistência do snapshot.
- Não chamar Mercado Pago nem APIs de notificações reais.

## Critérios de liberação

1. Confirmar que o ambiente de teste não possui integração externa ativa e que consumidores assíncronos não observarão dados sintéticos.
2. Garantir fixture sintética e rastreabilidade por identificadores de teste.
3. Provar resultados por asserts e conferir ausência de resíduos.
4. Se o teste for no Staging compartilhado, obter autorização específica após avaliar risco de consumidores externos; `ROLLBACK` por si só não garante reversão de efeitos fora do banco.

**Não foi possível provar** isolamento suficiente para executar DML com segurança no Staging compartilhado. Por isso, nesta etapa **nenhuma escrita foi realizada**.

**Gate Financeiro NO-GO**; Issue #90 aberta; DEC-021 permanece parcialmente aprovada no princípio contábil.
