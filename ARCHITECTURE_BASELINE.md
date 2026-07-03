# ARCHITECTURE_BASELINE.md

> Auditoria read-only da plataforma Localix — snapshot em 2026-07-03.
> Nenhum arquivo foi criado, alterado ou removido durante esta análise.

---

## 1. Resumo Executivo

Localix é uma plataforma **multi-tenant de delivery/food-service** construída em **TanStack Start v1 (React 19 + Vite 7)** com backend **Supabase (Lovable Cloud)**. A arquitetura é orientada a **domínios isolados** em `src/lib/<domain>/`, cada um com Services puros, EventBus interno, Validators e testes Vitest. Integrações com terceiros (Mercado Pago) passam exclusivamente por Edge Functions. Estado do restaurante é resolvido pelo `RestaurantSessionContext` — nunca por slug fixo.

**Domínios implementados:** Payments, Orders, Delivery, Inventory, Recipes, Production, Cost, Purchasing, Tenant, Notifications, Business Rules, Operations, Dashboard, Checkout, Ledger.

---

## 2. Estrutura de Pastas

```
src/
├── routes/                    # File-based routing (TanStack Router)
│   ├── __root.tsx
│   ├── _authenticated/        # Layout gate p/ dono do restaurante (24 páginas)
│   ├── api/public/            # Webhooks MP (callback, webhook)
│   ├── admin.*                # 13 rotas do superadmin
│   └── $slug.*                # Storefront público do restaurante
├── lib/                       # 15 domínios (ver §7-13)
├── components/                # UI + widgets por domínio
├── contexts/                  # Restaurant, Session, Orders realtime, Customer nav/notify
├── hooks/                     # use-auth, use-role, use-mobile, use-restaurant-status
├── integrations/supabase/     # client, client.server, auth-middleware, types (auto-gen)
└── router.tsx / start.ts / server.ts
supabase/
├── functions/ (mp-oauth, mp-oauth-callback, mp-payment-intent, mp-webhook)
└── migrations/ (106 arquivos)
```

**Camadas por domínio:** `Service` (orquestração) · `Validator` · `EventBus` · `Audit` · `types` · `README` · `test`.

---

## 3. Banco de Dados — Tabelas

**82 tabelas** no schema `public`. Agrupadas por domínio:

| Domínio | Tabelas |
|---|---|
| **Restaurante/Cardápio** | restaurants, menu_categories, menu_items, menu_item_images, builders, builder_groups, builder_options, featured_sections, coupons, reviews |
| **Clientes** | customer_profiles, customers, customer_addresses, customer_favorites, customer_points, customer_notifications |
| **Pedidos** | orders, order_status_history, order_pricing_snapshot, order_payment, order_profitability |
| **Pagamentos** | payments, payment_providers, payment_split, payment_logs, payment_reconciliation, payment_webhook_events, payment_event_queue, mercado_pago_accounts, oauth_states, platform_fees, platform_settings |
| **Delivery** | delivery_orders, delivery_timeline, drivers, driver_locations |
| **Inventory** | ingredients, inventory_locations, stock_movements, ingredient_cost_history |
| **Recipes** | product_recipes, product_recipe_items, product_recipe_versions, recipe_items, recipe_cost_snapshot |
| **Production** | production_orders, production_consumption, production_output, production_losses, production_batches |
| **Purchasing** | suppliers, supplier_products, supplier_favorites, supplier_quotes, purchase_requests, purchase_orders, purchase_order_items, quote_requests |
| **Financeiro** | financial_ledger, financial_movements, product_profitability |
| **Tenant** | tenant_configuration, tenant_branding, tenant_features, tenant_business_settings, tenant_delivery_settings, tenant_payment_settings, tenant_notifications, tenant_config_audit, tenant_config_versions |
| **Notifications** | notifications, notification_templates, notification_preferences, notification_logs, push_subscriptions |
| **Support** | support_tickets, support_messages, support_articles |
| **Business Rules** | business_rules, business_rule_execution_log |
| **Auth/RBAC** | user_roles, owner_profiles, webhook_events |

**RLS:** ativo em todas as tabelas listadas com policies (contagem entre 1–6). Padrão: restaurantes escopam por `owner_id = auth.uid()`; user_roles usa função `has_role()` SECURITY DEFINER.

**Triggers / Functions (`public`):** `tg_set_updated_at`, `assign_order_number`, `handle_new_customer`, `reset_demo_environment`, `tg_customer_addresses_single_default`, `tg_order_notify_customer`, `assign_support_ticket_number`, `tg_support_message_bump`, `has_role`, `tg_orders_snapshot_platform_fees`, `seed_demo_marketplace`.

---

## 4. Migrations

**106 migrations** entre `20260624210222` e `20260703141749`. Fluxo cronológico:

- **Fase 1 (24/06)** — bootstrap: restaurants, menu, orders, RLS base.
- **Fase 2 (25–27/06)** — customer area, coupons, reviews, favorites, tabs, featured, fixes.
- **Fase 3 (26–27/06)** — payments (MP, split, ledger, reconciliation), oauth_states.
- **Fase 4 (28/06–02/07)** — tenant configuration, notifications, business rules, delivery.
- **Fase 5 (03/07)** — inventory foundation, recipes, production, cost/profitability, purchasing.

Status: todas aplicadas em ordem determinística.

---

## 5. Edge Functions

| Nome | Objetivo | Entrada | Saída | Dependências |
|---|---|---|---|---|
| `mp-oauth` | Inicia OAuth do Mercado Pago | `{restaurantId, redirectTo}` | URL de autorização | oauth_states, MP_APP_ID |
| `mp-oauth-callback` | Recebe callback do MP e persiste tokens | `?code&state` | Redirect | mercado_pago_accounts, MP_TOKEN_ENC_KEY |
| `mp-payment-intent` | Cria payment intent no MP | `{orderId, amount, method}` | `{preferenceId, initPoint}` | mp-auth, PaymentService |
| `mp-webhook` | Processa notificações do MP | payload MP | 200 OK | payment_webhook_events, MP_WEBHOOK_SECRET |

Além disso, endpoints públicos vivem em `src/routes/api/public/mp.*.ts` (TanStack server routes).

---

## 6. EventBus

Cada domínio expõe **um EventBus próprio** (in-process, sem broker externo):

| Bus | Eventos principais |
|---|---|
| `OrderEventBus` (`orders/domain-events.ts`) | OrderCreated, OrderConfirmed, OrderInPreparation, OrderReady, OrderOutForDelivery, OrderDelivered, OrderCanceled |
| `PaymentEventBus` (`payments/EventBus.ts`) | PaymentCreated, PaymentApproved, PaymentRejected, PaymentRefunded, WebhookReceived |
| `DeliveryEventBus` | DeliveryAssigned, DeliveryPickedUp, DeliveryCompleted, DeliveryFailed |
| `NotificationEvents` | NotificationQueued, NotificationSent, NotificationFailed |
| `BusinessRulesEvents` | RuleTriggered, RuleExecuted, RuleFailed |
| `InventoryEventBus` | StockIncreased, StockDecreased, StockReserved, StockReleased, LowStockAlert |
| `RecipeEventBus` | RecipeCreated, RecipeActivated, RecipeVersioned, CostRecalculated |
| `ProductionEventBus` | ProductionPlanned, Started, Paused, Resumed, Completed, Cancelled, Failed, BatchCreated, BatchExpired, LossRegistered |
| `CostEventBus` | IngredientCostUpdated, RecipeCostRecalculated, OrderProfitCalculated |
| `PurchaseEventBus` | SupplierCreated/Changed, PurchaseRequested/Approved/Received, CostUpdated |

Padrão: publish/subscribe local; consumidores registram-se em bootstrap. **Não há broker distribuído** (Kafka/Redis) — todos os handlers rodam na mesma execução (server function ou request).

---

## 7. Business Rules

`src/lib/business/` — `BusinessRulesEngine` + `BusinessRuleRegistry` + `BusinessRuleExecutor`.

Categorias observadas em `rules/`: horário de funcionamento, capacidade da cozinha, restrições de pagamento, mínimo do pedido, cupons/promoções. Execuções registradas em `business_rule_execution_log`.

---

## 8. Payment Domain (`src/lib/payments/`)

- **Providers:** MercadoPago (implementado), Pagarme/Asaas/Stripe (calculadoras stub em `PricingEngine`).
- **PaymentService** — fachada única (createPayment/refresh/oauth).
- **PricingEngine** — cálculo autoritativo (subtotal, taxas plataforma, gateway, cashback, cupom). Cache 60s.
- **SplitService** / **LedgerService** / **ReconciliationService** — testados (`*.test.ts`).
- **PaymentIntentService** — cria intenções (testado).
- **WebhookService** — valida assinatura HMAC + processa eventos (testado).
- **OAuth** — via edge functions `mp-oauth` e `mp-oauth-callback`, tokens cifrados com `MP_TOKEN_ENC_KEY`.

---

## 9. Order Domain (`src/lib/orders/`)

- `OrderOrchestrator` — única entrada para transições (com `TransitionValidator`).
- `OrderStateMachine` — estados: novo, aguardando_confirmacao, em_preparo, pronto, saiu_para_entrega, entregue, cancelado.
- `OrderTimelineService`, `OrderAudit`, `OrderPermissions`.
- `domain-events.ts` mapeia state → event.

---

## 10. Delivery Domain (`src/lib/delivery/`)

`DeliveryEngine`, `DispatchEngine`, `AssignmentEngine`, `ETAEngine`, `TrackingService`, `DeliveryStateMachine`, `DeliveryTimeline`, `DeliveryEventBus`, providers/, rules/. Testado.

---

## 11. Inventory Domain

- **Foundation** (`inventory/`) — IngredientService, InventoryService (única entrada para stock write), StockMovementService, PurchaseOrderService, ProductRecipeService (compat), CostEngine local, MarginEngine, StockAlerts, Validator, Audit, EventBus.
- **Recipes** (`recipes/`) — RecipeService com versionamento imutável, RecipeCostEngine, RecipeSimulation, RecipeYieldEngine, RecipeValidator.
- **Production** (`production/`) — ProductionService (plan/start/pause/complete/cancel/loss), YieldEngine, LossEngine, Batches.
- **Cost** (`cost/`) — CostEngine (moving avg, snapshots imutáveis), MarginEngine, ProfitabilityEngine, Waste/Packaging/Labor/Overhead, SimulationEngine, CostAlerts.
- **Purchasing** (`purchasing/`) — PurchasingService, ReceivingService, QuotationEngine, ReplenishmentEngine, PurchaseSuggestionEngine, SupplierRanking.

---

## 12. Tenant Domain (`src/lib/tenant/`)

TenantConfigurationService + Cache + Validator + Versioning + Audit. Tabelas: `tenant_configuration`, `tenant_branding`, `tenant_features`, `tenant_business_settings`, `tenant_delivery_settings`, `tenant_payment_settings`, `tenant_notifications`, `tenant_config_audit`, `tenant_config_versions`.

---

## 13. Notification Domain (`src/lib/notifications/`)

NotificationCenter + Dispatcher + TemplateEngine + PreferenceService + Scheduler + RetryEngine + AuditService + providers/. Tabelas: notifications, notification_templates, notification_preferences, notification_logs, push_subscriptions. Trigger DB `tg_order_notify_customer` gera notificações a partir de mudanças de status.

---

## 14. Dashboards

- **Restaurant Dashboard** (`src/lib/dashboard/`) — WidgetRegistry, workspaces, permissions, theme, DashboardService (testado).
- **Operations Center** (`src/lib/operations/`) — OperationsService, PriorityEngine, AlertsEngine, KitchenSounds, Realtime, Metrics, Filters, Permissions, columns, types (testado).
- **Widgets:** InventoryWidget, NotificationWidget, RestaurantStatusWidget.
- **Admin (superadmin):** 13 rotas em `src/routes/admin.*`.

---

## 15. Testes

**19 suites Vitest** cobrindo: BusinessRules, Checkout/OrderService, Cost, Dashboard, Delivery, InventoryFoundation, Ledger, Notifications, Operations, OrderOrchestrator, PaymentIntent, Pricing, Reconciliation, Split, Webhook, Production, Purchasing, Recipes, Tenant.

Cobertura por domínio: unit/integration em Services; sem E2E Playwright configurado. Cobertura % não medida (sem `--coverage` no CI observável).

---

## 16. Segurança

- **Auth:** Supabase Auth (email/password + Google). Middleware `requireSupabaseAuth` + `attachSupabaseAuth`.
- **RBAC:** tabela `user_roles` + função `has_role()` SECURITY DEFINER (nunca no perfil).
- **RLS:** ativo em todas as 82 tabelas.
- **OAuth MP:** state em `oauth_states`, tokens cifrados (`MP_TOKEN_ENC_KEY`).
- **Webhooks:** assinatura HMAC verificada com `MP_WEBHOOK_SECRET`.
- **Secrets:** MP_ACCESS_TOKEN, MP_APP_ID, MP_PUBLIC_KEY, MP_TOKEN_ENC_KEY, MP_WEBHOOK_SECRET, LOVABLE_API_KEY, SUPABASE_* — todos server-side.
- **Rotas `/api/public/*`** contornam auth por design; verificação de assinatura obrigatória no handler.

---

## 17. Performance

- **Cache in-memory:** PricingEngine settings (60s), TenantConfigurationCache.
- **Lazy loading:** rotas via TanStack Router code-splitting automático.
- **Paginação:** presente em listagens (payments.listByRestaurant limit=100 etc.).
- **Realtime:** OrdersRealtimeContext + CustomerNotificationsContext (Supabase Realtime).
- **Sem filas persistentes** — `payment_event_queue` existe mas processada síncrona.
- **Sem workers dedicados** — server functions on-demand.

---

## 18. Documentação

READMEs existentes:

- BusinessRulesEngine, CostEngine, RestaurantDashboardFoundation, DeliveryEngine, InventoryFoundation, NotificationCenter, RestaurantOperationsCenter, OrderOrchestrator, PricingEngine, ProductionEngine, PurchasingDomain, RecipeDomain, TenantConfigurationService.
- `src/routes/README.md`, `src/lib/payments/README.md`, `AGENTS.md`.

Falta README de: checkout, ledger, operations metrics, dashboard, tenant migrations, admin.

---

## 19. Matriz de Dependências (alto nível)

```
Checkout ──► OrderOrchestrator ──► OrderEventBus
                    │
                    ├──► BusinessRulesEngine
                    ├──► PricingEngine ──► platform_settings
                    ├──► PaymentService ──► Providers (MP) ──► Edge Fns
                    │        └──► PaymentEventBus ──► LedgerService / SplitService / ReconciliationService
                    ├──► DeliveryEngine ──► Dispatch / Assignment / ETA / Tracking
                    └──► NotificationCenter ◄── DB trigger tg_order_notify_customer

RecipeService ──► InventoryService (reserve / decrease)
ProductionService ──► RecipeService + InventoryService
CostEngine ◄── ReceivingService (PurchasingDomain)
PurchasingService / ReceivingService ──► InventoryService + CostEngine
TenantConfigurationService ──► Cache ──► leitura por todos os domínios
Dashboard / OperationsCenter ──► leitura de Orders + Delivery + Inventory + Notifications
```

Nenhum ciclo direto detectado entre domínios de alto nível. `InventoryService` é ponto único de escrita de estoque — pré-condição do isolamento entre Recipes/Production/Purchasing.

---

## 20. Duplicações, código morto, débitos

- **Duplicação intencional:** `src/lib/inventory/CostEngine.ts` (foundation) + `src/lib/cost/CostEngine.ts` (domínio dedicado). Consolidar em uma iteração futura.
- **Duplicação:** `src/lib/inventory/MarginEngine.ts` + `src/lib/cost/MarginEngine.ts`.
- **Duplicação:** `src/lib/inventory/ProductRecipeService.ts` (compat) vs `src/lib/recipes/RecipeService.ts`.
- **Duplicação:** `src/lib/inventory/PurchaseOrderService.ts` vs `src/lib/purchasing/PurchasingService.ts`.
- **PaymentService** contém stubs (`createPayment`, `refreshStatus`) que lançam "não implementado".
- **Gateway calculators** (Pagarme/Asaas/Stripe) retornam 0 — placeholders.
- **`payment_event_queue`** existe sem processador dedicado.
- **Sem TODOs/FIXMEs** relevantes em grep amostral — código limpo.
- **Repositórios Supabase** ainda pendentes em: Production, Cost, Purchasing (documentado nos READMEs).
- **Eventos duplicados:** `CostUpdated` emitido tanto em `CostEventBus` quanto em `PurchaseEventBus` — nomes iguais em buses diferentes; consolidar futuramente.
- **Tabelas potencialmente redundantes:** `payments` vs `order_payment` (fluxos separados por origem); `financial_ledger` vs `financial_movements` (granularidades distintas).

Nenhuma **dependência cíclica** de módulo detectada.

---

## 21. Relatório de Saúde

| Dimensão | Nota (0-100) | Observação |
|---|---|---|
| Arquitetura geral | **86** | Domínios isolados, EventBus por domínio, camadas bem definidas. |
| Escalabilidade | **70** | Falta broker/queue persistente; workers ausentes; realtime Supabase escala bem até médio porte. |
| Segurança | **84** | RLS 100%, RBAC via SECURITY DEFINER, tokens cifrados, webhooks assinados. Pendente pentest formal. |
| Performance | **72** | Cache leve, paginação simples, sem CDN de assets custom, sem SSG. |
| Manutenibilidade | **88** | Padrão consistente Service/Validator/EventBus/README/Test em cada domínio. |
| Cobertura de testes | **68** | 19 suites Vitest, cobertura % não medida, sem E2E. |
| Complexidade | **75** | 82 tabelas, 15 domínios — grande, mas bem organizado. |
| Risco técnico | **Médio-baixo** | Principais riscos: duplicações inventory/cost, repositórios Supabase pendentes nos domínios novos, placeholders de gateway. |
| Débito técnico | **Baixo-médio** | Consolidação de duplicatas + finalização de repositórios + processamento de `payment_event_queue`. |
| Prontidão para produção | **78** | Fluxos core (pedido → pagamento → entrega → notificação) prontos e testados; domínios novos (Cost/Production/Purchasing) precisam de adapters Supabase + UI para produção plena. |

---

## Encerramento

Baseline registrado. Nenhum arquivo do projeto foi modificado — este relatório é o único artefato gerado.
Aguardando novos comandos.

---

## Update 2026-07-03 — Product Domain Foundation

- Novo pacote `src/lib/product/` (Lifecycle, Validator, EventBus, AvailabilityService, SearchService, ProductService server fns).
- Novas tabelas: `product_versions` (imutável, RLS owner), `product_media` (image/video/model_3d, RLS owner + read público), `product_audit` (RLS owner).
- Trigger `tg_block_product_versions_mutation` garante versões imutáveis.
- Eventos: `ProductCreated | Updated | Published | Archived | Discontinued | AvailabilityChanged | LifecycleChanged`.
- Reuso integral: `menu_items`, `menu_item_images`, `builders*`, `featured_sections`, `ProductImageUploader`, `image-upload.ts`, `favorites.ts`, `public-restaurant.functions.ts`.
- Sem alterações em Inventory / Recipe / Cost / Pricing / Checkout / OrderOrchestrator / Delivery / BusinessRulesEngine / NotificationCenter / TenantConfigurationService / Restaurant Dashboard.

## Platform Administration Domain (Prompt 14)

Módulo `src/lib/platform/` — painel administrativo global do Localix.
Uso exclusivo por administradores da plataforma. Zero regressão: nenhum
domínio existente foi alterado e nenhuma migration foi criada.

- Serviços puros consumindo `restaurants`, `orders`, `user_roles`,
  `platform_settings`, `platform_fees`, `support_tickets`, `reviews`.
- RBAC próprio (6 papéis) sobrepondo `has_role('admin')` existente.
- Catálogo de planos (Free/Starter/Pro/Enterprise) determinístico.
- Dashboard, tenants, assinaturas, auditoria, suporte, moderação,
  incidentes e notificações globais como projeções.
- Persistência de auditoria administrativa: `InMemoryPlatformAudit
  Repository` (pending Supabase repo — ver TECHNICAL_DEBT.md).

Ver `src/lib/platform/PlatformAdministration.README.md` e
`src/lib/platform/DOMAIN_MANIFEST.md`.

## Platform Configuration & Feature Flag System (Prompt 15)

Módulo `src/lib/platform-config/` — fonte-única para configuração global,
feature flags, remote config, kill switches e recursos por plano. Nenhum
módulo mantém configuração isolada; consumidores usam
`platformConfiguration` (facade singleton).

Complementar ao `TenantConfigurationService` (que continua sendo dono das
configurações por tenant). Camada pura, sem migrations novas, sem tocar
nenhum domínio existente. Auditoria imutável, versionamento com rollback
seguro, rollout gradual determinístico (FNV-1a).

Ver `src/lib/platform-config/PlatformConfiguration.README.md`.
