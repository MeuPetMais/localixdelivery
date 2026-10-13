# CAT-4 — Validação E2E controlada da hierarquia de categorias

- **Data:** 2026-10-13
- **Decisão:** DEC-015
- **Status:** PASS TÉCNICO CONTROLADO

## Escopo validado

Foram validados, sem persistência de dados sintéticos:

- criação de categoria principal;
- criação de subcategoria;
- vínculo de produto à subcategoria;
- visibilidade pública derivada da categoria principal;
- visibilidade pública da subcategoria;
- isolamento entre restaurantes;
- proteção contra exclusão da categoria principal com filho;
- ausência de resíduos após rollback;
- builds/deploys de produção e staging.

## Evidência de banco

Teste executado em transação com `ROLLBACK`.

Resultado:

```text
CAT4_DB_FLOW_PASS
residual_categories = 0
residual_items = 0
```

O teste criou dados sintéticos somente dentro da transação e comprovou:

1. categoria principal aceita metadados;
2. subcategoria aceita pai do mesmo restaurante;
3. produto pode apontar para a subcategoria via `menu_items.category_id`;
4. `private.menu_category_is_publicly_visible(root_id)` retorna verdadeiro quando o produto ativo está apenas no filho;
5. alteração cross-tenant é rejeitada;
6. exclusão da categoria-mãe com filho é bloqueada por FK;
7. rollback remove integralmente os dados de teste.

## Compatibilidade

Antes do CAT-1:
- 16 categorias;
- 32 produtos;
- 32 produtos categorizados;
- 0 produtos órfãos.

Após migration e testes:
- 16 categorias;
- 32 produtos;
- 32 produtos categorizados;
- 0 produtos órfãos.

## Deploy

CAT-2 e CAT-3 foram publicados com:
- produção: READY / SUCCESS;
- staging: READY / SUCCESS;
- sem `aliasError`.

## Checkout e financeiro

A DEC-015 não alterou:
- `OrderService`;
- `PricingEngine`;
- `PaymentService`;
- Mercado Pago;
- split;
- taxa de serviço;
- Localix Benefits.

**Não foi possível provar.** Ainda não foi executado neste gate um pedido E2E real pela interface usando um produto em subcategoria.

Portanto, o gate é encerrado como **PASS TÉCNICO CONTROLADO**, e não como validação operacional financeira completa.

## Próxima validação recomendada

Executar pedido controlado em ambiente apropriado com:
1. produto vinculado a subcategoria;
2. adição ao carrinho;
3. preview de preço autoritativo;
4. criação do pedido;
5. conferência dos valores persistidos;
6. confirmação de que a hierarquia de categoria não interfere no preço nem no pagamento.
