# Cost & Profitability Engine

Domínio de custos financeiros do Localix. **Não altera** Inventory, Recipe, Production, PricingEngine, OrderOrchestrator, BusinessRulesEngine, FinancialLedger.

## Arquitetura

```
Inventory → CostEngine → MarginEngine → ProfitabilityEngine → Analytics → Dashboard
```

## Componentes

| Módulo | Responsabilidade |
|---|---|
| `CostEngine` | Custo de ingrediente / receita / produto / pedido; custo médio ponderado |
| `MarginEngine` | Margem bruta, líquida, markup, CMV %, lucro % |
| `ProfitabilityEngine` | Ranking de produtos, categorias, pedidos, clientes, horários |
| `WasteCostEngine` | Perdas e desperdício |
| `PackagingCostEngine` | Custo de embalagens |
| `LaborCostEngine` | Estrutura para custo de mão de obra |
| `OverheadEngine` | Estrutura para custos fixos (energia, água, aluguel) |
| `SimulationEngine` | Simulação what-if (preço, custo, fornecedor) |
| `CostAlerts` | Margem baixa, prejuízo, ingrediente caro, CMV elevado |
| `CostEventBus` | Eventos `IngredientCostUpdated`, `RecipeCostUpdated`, `ProductProfitUpdated`, `OrderProfitCalculated`, `MarginChanged` |

## Snapshots (histórico imutável)

- `ingredient_cost_history` – uma linha por atualização de custo
- `recipe_cost_snapshot` – snapshot por versão de receita
- `order_profitability` – **um único registro por pedido**; `calculateOrderCost` retorna o snapshot existente e nunca recalcula

## Integrações

- **InventoryService** → dispara `calculateIngredientCost` em compras/recebimentos
- **RecipeService** → dispara `calculateRecipeCost` ao ativar receita
- **ProductionEngine** → informa rendimento real para atualizar custo médio
- **OrderOrchestrator** → ao finalizar pedido, chama `calculateOrderCost` (snapshot final)

## CMV, Margem e Lucro

```
Margem bruta  = (preço - custo receita) / preço
Margem líquida = (preço - custo receita - extras) / preço
Markup         = (preço - custo) / custo
CMV %          = custo / preço
```

## Testes

`src/lib/cost/CostEngine.test.ts` cobre margem, CMV, custo médio, snapshots, simulações, alertas, desperdício, packaging e evento `OrderProfitCalculated`.

## Pendências

- Repositório Supabase (adapter para `CostRepository`)
- Wiring em `OrderOrchestrator.onCompleted` para gerar snapshot
- Widget de Cost Dashboard e Ranking de Rentabilidade na UI
