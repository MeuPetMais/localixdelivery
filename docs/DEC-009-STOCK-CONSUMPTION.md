# DEC-009 — Consumo automático de estoque por pedido

- **Data:** 2026-09-02
- **Status:** Aprovada para implementação controlada
- **Escopo:** Pedidos, ficha técnica, ingredientes, estoque e movimentações

## Problema

Pedidos com ficha técnica cadastrada em `recipe_items` não estavam produzindo uma baixa confiável, auditável e reversível de estoque. A rotina legada consumia estoque no `INSERT` de `orders`, alterava diretamente `ingredients.stock` e não registrava `stock_movements`.

## Contexto

A interface atual do parceiro para Estoque/Ficha Técnica grava a ficha em `recipe_items`. Também existem estruturas mais novas (`product_recipes` / `product_recipe_items`), mas elas não são a fonte operacional usada pela tela atual e não serão migradas dentro do EST-01.

## Opções consideradas

1. Manter a baixa no `INSERT` do pedido.
2. Migrar imediatamente toda a ficha técnica para `product_recipes` / `product_recipe_items`.
3. Manter `recipe_items` como fonte operacional do piloto e tornar o consumo transacional, auditável e idempotente na aceitação do pedido.

## Decisão

Durante o piloto, `recipe_items` será a fonte autoritativa para consumo de estoque de produtos normais.

O estoque será consumido quando o pedido transicionar para `aceito`, e não mais no `INSERT` de `orders`.

A baixa e a reversão devem ocorrer dentro da mesma transação de banco da mudança de status do pedido. Toda alteração automática deverá registrar `stock_movements`.

## Regras

- Quantidade consumida = `recipe_items.quantity × quantidade do item no pedido`.
- Produtos sem ficha técnica são ignorados sem interromper os demais itens.
- Builders e modificadores ficam fora do EST-01 até existir vínculo explícito entre opção e ingrediente.
- Não haverá conversão automática de unidades nesta fase; a quantidade da ficha é interpretada na unidade do ingrediente.
- O estoque não pode ficar negativo no aceite. Estoque insuficiente deve impedir a transição e não pode gerar baixa parcial.
- Consumos devem ser idempotentes por `order_id + ingredient_id + operação`.
- Cancelamento ou reembolso após consumo deve criar movimento inverso, preservando o movimento original.
- A reversão usa a quantidade do movimento original, nunca a ficha técnica atual.
- Pedidos históricos não recebem baixa retroativa.

## Motivo

Esta solução corrige o problema com o menor impacto sobre a arquitetura atual, evita uma refatoração ampla durante o piloto e cria uma trilha operacional auditável para estoque.

## Impacto

Afeta:

- `orders` e a state machine de status;
- `recipe_items`;
- `ingredients`;
- `stock_movements`;
- cancelamentos e reembolsos pós-aceite.

Não altera regras de Checkout, PricingEngine, PaymentService ou Mercado Pago.

## Riscos

- Fichas com unidade cadastrada incorretamente continuarão produzindo consumo numericamente incorreto, pois conversão de unidades está fora deste escopo.
- Builders/adicionais ainda não terão consumo automático.
- Ajustes manuais de estoque continuam sem ledger próprio e devem ser tratados em item separado (EST-02).

## Condição para revisão

Revisar esta decisão quando:

- `product_recipes` / `product_recipe_items` passar a ser a ficha técnica oficial da interface;
- Builder/modificadores receberem vínculo de ingredientes;
- houver necessidade de conversão de unidades;
- o piloto exigir reserva de estoque antes do aceite.
