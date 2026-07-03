# Product Configuration Engine

Motor genérico de configuração de produtos (pizza, hambúrguer, açaí, poke, combos, etc.).

## Estrutura

```
Product → Groups → Options → Rules → Price → Inventory → Checkout
```

## Tabelas

- `product_option_groups` — agrupa opções (Tamanho, Sabores, Adicionais, Borda…)
- `product_options` — opção individual com preço, imagem, estoque e receita opcionais

RLS: leitura pública, escrita apenas para o dono do restaurante (`restaurants.owner_id`).

## Tipos de grupo

`SINGLE` · `MULTIPLE` · `QUANTITY` · `BOOLEAN`

## Estratégias de preço

`SUM` · `AVERAGE` · `MAX` · `FIXED` · `CUSTOM`

Ex: pizza de 2 sabores usa `AVERAGE`; tamanhos costumam usar `MAX`; adicionais usam `SUM`.

## Dependências

Um grupo pode declarar `depends_on_option_id`. O grupo só é validado se a opção pai estiver selecionada — ex.: "Recheio da borda" só aparece quando "Borda recheada" está ativa.

## API

- `ConfigurationRuleEngine.validate(groups, options, selections)` — valida seleção
- `PriceCalculationStrategy.calculate(basePrice, groups, options, selections, fixedPrice?)` — preço final
- Server fns: `listConfiguration`, `upsertGroup`, `upsertOption`, `deleteGroup`, `deleteOption`
- `ConfigurationEventBus` — `OptionCreated`, `GroupUpdated`, `ConfigurationChanged`, `ComboCreated`, …

## Integrações

- **Inventory**: `product_options.inventory_reference → ingredients.id`
- **Recipes**: `product_options.recipe_reference → product_recipes.id`
- **Pricing Engine / Checkout**: usar `PriceCalculationStrategy` + `ConfigurationRuleEngine` antes de adicionar ao carrinho
- **BusinessRulesEngine**: pode consumir eventos do `ConfigurationEventBus`

## Testes

`ProductConfigurationEngine.test.ts` — grupos, opções, regras, dependência, SUM/MAX/AVERAGE/FIXED.
