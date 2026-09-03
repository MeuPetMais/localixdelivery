# RW-PROD-01 — Reconciliação Staging × Produção

Data: 2026-09-03
Status: APROVADO funcionalmente / produção não alterada

## Objetivo

Revalidar Localix Benefits + Localix Rewards contra o estado atual do schema de produção antes de qualquer deploy, pois staging estava atrás de mudanças recentes em entregadores, pedidos e estoque.

## Divergência encontrada

Produção continha seis migrations que não existiam no histórico do staging durante a validação inicial de Rewards:

- `sync_driver_earning_to_order_delivery_fee`
- `sync_delivery_assignment_to_order_status`
- `driver_multi_restaurant_memberships`
- `est01_transactional_order_stock`
- `est01_limit_stock_reversal_before_preparation`
- `est02_builder_option_ingredients`

Os registros do Supabase usam o timestamp de aplicação; os arquivos originais localizados no GitHub usam timestamps ligeiramente diferentes.

## Proveniência recuperada no GitHub

Commits originais localizados:

- `234a5fccf46938413bac888ae083647ee90c404d` — `fix(delivery): align driver earning with charged delivery fee`; arquivo `20260831215000_sync_driver_earning_to_order_delivery_fee.sql`.
- `e37f947c2629f1d72d961a1443ac1726d82c7682` — `fix(delivery): sync courier transitions with order status`; arquivo `20260831221000_sync_delivery_assignment_to_order_status.sql`.
- `48f721c4dbe7028ab71bfd2c52d8797858615411` + follow-up `bced862135b63b2c09689b9e7ec538371fdd3b90` — multi-restaurante do entregador; arquivo `20260901160000_driver_multi_restaurant_memberships.sql`.
- `d398c61f12f0b022b36b26305e15ee5882e9ebd9` — `fix(stock): consume recipe inventory on order acceptance`; arquivo `20260902153000_est01_transactional_order_stock.sql`.
- `d7170c9afe341348b49415b20e58a1a508af3cab` — `fix(stock): stop auto reversal after preparation starts`; arquivo `20260902170500_est01_limit_stock_reversal_before_preparation.sql`.
- `f8113b6d8e5f15743e724dcc6fa0c923c745f992` — `feat(stock): support builder option ingredient consumption`; arquivo `20260902171000_est02_builder_option_ingredients.sql`.

Observação: esses commits/migrations não estão todos presentes no `main` atual, embora o estado correspondente esteja implantado em produção. Portanto o pacote de Rewards não deve tentar reaplicar essas migrations em produção.

## Reconciliação executada no staging

Foi aplicada somente no staging a migration de reconciliação registrada como:

`20260903191355 rw_prod_01_reconcile_current_production_schema`

Ela reproduziu o estado operacional relevante de produção antes de reexecutar os testes Rewards:

- `driver_restaurant_memberships` + RLS + sincronização de identidade;
- ganho do entregador autoritativo a partir de `order_pricing_snapshot.delivery_fee`;
- sincronização `delivery_assignment → orders` para `EM_ROTA/ENTREGUE`;
- `builder_option_ingredients` + RLS;
- índices idempotentes de `stock_movements`;
- consumo de estoque somente em `aceito`;
- reversão automática somente em `aceito → cancelado/reembolsado`;
- suporte a consumo de ingredientes de Builder;
- remoção do trigger legado de consumo no INSERT de pedido.

A reconciliação de staging endureceu EXECUTE dos helpers de trigger novos em relação ao estado atual de produção, revogando chamada direta por `anon/authenticated` quando a função só deve ser usada por trigger. Isso não altera a semântica funcional testada.

## Backfills one-time

A leitura dos commits originais mostrou dois backfills que não eram visíveis apenas pela introspecção do schema:

1. entregas com assignment `ENTREGUE` e order ainda `pronto/saiu_para_entrega`;
2. perfis de entregador ativos sem `owner_id` cujo CPF já pertence a uma identidade Localix ativa.

Antes de qualquer correção foi consultado o staging atual:

- stale deliveries elegíveis: `0`;
- perfis ativos órfãos com mesmo CPF: `0`.

Portanto não havia linha pendente a corrigir.

## Testes de compatibilidade

Todos executados em `BEGIN ... ROLLBACK`, sem resíduos persistentes.

### 1. Pedido normal + estoque + Rewards + refund tardio

Fluxo:

`pago → aceito → em_preparo → pronto → concluido → reembolsado`

Validado:

- INSERT do pedido não altera estoque;
- `pago → aceito` consome estoque exatamente uma vez;
- `concluido` gera exatamente uma qualificação Rewards e um crédito Benefits;
- refund depois de `concluido` não devolve estoque fisicamente consumido;
- o crédito Rewards não usado é revogado integralmente;
- exatamente um evento `REWARD_REVERSED` é gravado.

### 2. Builder + cancelamento antes do preparo

Configuração de teste: opção Builder consumindo `1.5` unidades × seleção quantidade `2`.

Validado:

- estoque `10 → 7` em `aceito`;
- exatamente um movimento de consumo;
- `aceito → cancelado` restaura `7 → 10`;
- exatamente um movimento de reversão.

### 3. Entregador + snapshot + sincronização de pedido

Validado:

- inserção do entregador cria um vínculo em `driver_restaurant_memberships`;
- `driver_earning_amount` recebe o `delivery_fee` do snapshot (R$ 5 no teste);
- `ATRIBUIDO → EM_ROTA` sincroniza order para `saiu_para_entrega`;
- `EM_ROTA → ENTREGUE` sincroniza order para `entregue`.

## Estado final do staging

- `localix_rewards_enabled = false`
- `localix_benefits_enabled = false`
- `rewards_operational_health().ok = true`
- fila pendente = 0
- retryable failed = 0
- exhausted = 0
- clawback pending = 0
- worker ativo = 1
- resíduos sintéticos = 0

## Produção

Produção não recebeu nenhum objeto do Localix Rewards/Benefits durante este gate.

Confirmado ao final:

- `reward_programs` ausente;
- `reward_order_event_queue` ausente;
- `localix_rewards_enabled` ausente.

## Segurança

O advisor continua apontando débitos pré-existentes de `SECURITY DEFINER` expostos a `anon/authenticated`, inclusive `order_apply_transition`, Loyalty, Delivery e Support. Esses débitos não foram criados pelo Rewards e permanecem fora do escopo deste gate, mas devem continuar no backlog de hardening, especialmente `SEC-LOY-01`.

As tabelas Rewards/Benefits internas com RLS e sem policy direta são deny-all por desenho; as mutações econômicas continuam restritas a RPCs privilegiadas.

## Conclusão

RW-PROD-01 — compatibilidade funcional no schema reconciliado: **APROVADA**.

Proveniência das seis mudanças recentes: **RECUPERADA E COMPARADA**.

Produção: **NÃO ALTERADA**.

Próximo gate: preparar um plano de release incremental de Benefits + Rewards que considere que produção já contém as seis migrations operacionais, mantenha ambos kill switches OFF durante instalação e faça smoke test antes de qualquer ativação.
