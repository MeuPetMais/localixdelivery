# Purchasing & Supplier Management

Domínio de compras do Localix — isolado, **não altera** Inventory Foundation, Recipe, Production, Cost Engine, InventoryService, FinancialLedger, OrderOrchestrator, BusinessRulesEngine, NotificationCenter, TenantConfigurationService.

## Arquitetura

```
Supplier → Quotation → PurchaseRequest → PurchaseOrder → Receiving → Inventory → CostEngine
```

## Componentes

| Módulo | Responsabilidade |
|---|---|
| `PurchasingService` | CRUD fornecedores, requisições (OPEN/APPROVED/REJECTED/ORDERED), cotações |
| `ReceivingService` | Recebe mercadorias, delega para `InventoryService.increaseStock` e `CostEngine.calculateIngredientCost` (registra lote/validade) |
| `QuotationEngine` | `best()` (menor preço) e `compare()` (score preço + prazo + qualidade) |
| `ReplenishmentEngine` | Estoque de segurança, ponto de reposição, quantidade sugerida, pack size |
| `PurchaseSuggestionEngine` | Lista de compras automática priorizando urgentes |
| `SupplierRanking` | Preço, entrega no prazo, qualidade, volume |
| `PurchaseEventBus` | `SupplierCreated`, `SupplierChanged`, `PurchaseRequested`, `PurchaseApproved`, `PurchaseReceived`, `CostUpdated` |

## Tabelas

- `suppliers` (estendida): `lead_time`, `minimum_order_value`, `payment_terms`, `delivery_days`, `rating`, `preferred_supplier`
- `supplier_products` (estendida): `ingredient_id`, `supplier_sku`, `minimum_quantity`, `lead_time`, `last_purchase`, `status`
- `purchase_requests` — status enum `purchase_request_status`
- `supplier_quotes`

RLS: dono do restaurante gerencia seus próprios registros; `service_role` para operações internas.

## Integrações

- **InventoryService** → `ReceivingService` chama `increaseStock` (nunca acessa estoque diretamente)
- **CostEngine** → snapshot de custo histórico ao receber (`calculateIngredientCost`); histórico **imutável**
- **NotificationCenter** → consumir `CostUpdated`/`PurchaseReceived` para alertas (fornecedor atrasado, preço elevado, reposição)

## Testes

`src/lib/purchasing/PurchasingDomain.test.ts` cobre fornecedores, pedidos, aprovação, cotação, reposição, sugestões, ranking e recebimento.

## Pendências

- Repositório Supabase (adapter para `PurchasingRepository`)
- Dashboard de Fornecedores e Compras na UI
- Integração NotificationCenter (fornecedor atrasado, preço elevado)
