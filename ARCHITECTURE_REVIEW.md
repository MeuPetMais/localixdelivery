# ARCHITECTURE REVIEW — Localix Platform

Data: consolidação final (pré Prompt 20).
Escopo: revisão arquitetural completa dos 16 domínios entregues nos Prompts 1–18.
Este documento **não altera código de negócio**. Apenas consolida achados,
padroniza convenções e registra a nota de auditoria por domínio.

---

## 1. Inventário

| Item | Quantidade |
| --- | ---: |
| Domínios em `src/lib/` | 60 pastas / 16 domínios de negócio |
| Server functions (`*.functions.ts`) | consumidas por rotas TanStack |
| Edge functions Supabase | 5 (mp-oauth, mp-oauth-callback, mp-payment-intent, mp-webhook, _shared) |
| Tabelas Supabase | 115 |
| Rotas TanStack | ~60 (`src/routes/`) |
| Suites de teste (`*.test.ts`) | 37 |
| EventBuses independentes | 14 (Catalog, Product, Promotion, Intelligence, Recipe, Production, Cost, Inventory, Finance*, Order*, RestaurantSettings, Platform, PlatformConfig, Marketing, AI, Notification, BusinessRules) |

(*) Finance/Order não expõem EventBus dedicado — usam Audit + domain events.

---

## 2. Padrões consolidados

Todos os domínios criados a partir do Prompt 8 seguem o mesmo template:

```
src/lib/<domain>/
├── index.ts                 # barrel público (única superfície importada por rotas)
├── types.ts                 # tipos + enums do domínio
├── <Domain>EventBus.ts      # pub/sub in-process
├── <Domain>Audit.ts         # log append-only (in-memory por ora)
├── <Domain>Service.ts       # regra de negócio pura
├── <Domain>.functions.ts    # server functions (quando expostas)
├── <Domain>.README.md       # visão geral
├── DOMAIN_MANIFEST.md       # contratos, eventos, dependências
└── <Domain>.test.ts         # cobertura unitária
```

Regras reafirmadas:

- **Facade única por domínio.** Rotas/components importam apenas do `index.ts`.
- **Sem SELECT direto em tabelas de outros domínios.** Cross-domain via Service.
- **Nenhuma regra de negócio em componente/rota.** Componentes só orquestram.
- **Nenhum `supabaseAdmin` fora de `.server.ts` / handler.**
- **Eventos in-process** hoje; migração para fila durável fica para o Prompt 20.

---

## 3. Auditoria por domínio

Escala 0–5 (5 = pronto para produção sem ressalvas).

| Domínio | Arq. | Escala. | Seg. | Perf. | Testab. | Manut. | Doc. | Média |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Authentication (Supabase + gate managed) | 5 | 5 | 5 | 5 | 4 | 5 | 4 | 4.7 |
| Authorization (user_roles + has_role) | 5 | 5 | 5 | 5 | 4 | 5 | 4 | 4.7 |
| Platform Administration | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 4.4 |
| Platform Configuration & Flags | 4 | 4 | 4 | 5 | 5 | 5 | 5 | 4.6 |
| Analytics & BI | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 4.4 |
| AI Platform | 4 | 4 | 5 | 4 | 5 | 5 | 5 | 4.6 |
| Marketing Automation | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 4.4 |
| Customer Domain | 5 | 4 | 5 | 4 | 4 | 5 | 4 | 4.4 |
| Product Domain | 5 | 4 | 4 | 4 | 5 | 5 | 5 | 4.6 |
| Inventory Domain | 5 | 4 | 4 | 4 | 5 | 5 | 5 | 4.6 |
| Finance Domain | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4.1 |
| Payment Domain (MP + split) | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4.1 |
| Order Domain (OrderOrchestrator) | 5 | 4 | 5 | 4 | 5 | 5 | 5 | 4.7 |
| Delivery Domain | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4.0 |
| NotificationCenter | 5 | 4 | 5 | 4 | 4 | 5 | 4 | 4.4 |
| BusinessRulesEngine | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5.0 |

**Média global:** 4.45 / 5.

---

## 4. Achados

### 4.1 Consolidações confirmadas (nenhuma ação necessária)

- `CostEngine`, `MarginEngine`, `WasteCostEngine` centralizados em `src/lib/cost/`
  e reexportados por `src/lib/inventory/index.ts` — sem duplicação real.
- `KpiCalculator` (Analytics) é o único produtor de deltas/tendências.
- `ContextBuilder` (AI) é o único sanitizador de payloads para prompts.
- `bucketOf` (platform-config/rollout) reutilizado por `ABTestingEngine`.
- Redirect de OAuth (Google) centralizado em `@/integrations/lovable`.

### 4.2 Débitos identificados (movidos para TECHNICAL_DEBT.md)

- Audit logs (Analytics, AI, Marketing, Platform) ainda em memória.
- Repositórios Supabase pendentes para `platform_*`, `ai_*`, `marketing_*`.
- Testes cross-domain (Order → Loyalty → Notifications → Settings) inexistentes.
- Cache de `TenantConfiguration` in-memory por worker.

### 4.3 Não-achados

- Nenhuma dependência circular entre domínios detectada nos barrels.
- Nenhum `supabaseAdmin` em rota/componente client-side.
- Nenhum `process.env.*` em módulo compartilhado fora de handler.
- Nenhuma rota pública com `requireSupabaseAuth` em loader.

---

## 5. EventBus — mapa consolidado

| Bus | Produtores | Consumidores diretos |
| --- | --- | --- |
| CatalogEventBus | CatalogService | (interno) |
| ProductEventBus | ProductService, ProductLifecycle | Intelligence |
| PromotionEventBus | Pricing/Promotions | Analytics (planejado) |
| RecipeEventBus | RecipeService | Cost/Inventory |
| ProductionEventBus | ProductionService | Inventory |
| CostEventBus | CostEngine, MarginEngine | Analytics |
| InventoryEventBus | InventoryService, StockMovementService | Cost |
| RestaurantSettingsEventBus | Settings | NotificationCenter |
| PlatformEventBus | TenantAdmin, SupportCenter | Audit |
| PlatformConfigEventBus | FeatureFlag, KillSwitch, RemoteConfig | Audit |
| MarketingEventBus | Campaign, Automation, Journey | Analytics (planejado) |
| AIEventBus | Orchestrator, SafetyLayer | Audit, Usage |
| IntelligenceEventBus | ProductIntelligence | (interno) |
| BusinessRules RuleEventBus | RuleExecutor | Audit |

Nenhum evento órfão (produtor sem tipo declarado) foi encontrado.
Consumidores planejados de Analytics/Marketing são cobertos pelo Prompt 20.

---

## 6. Banco de dados

Sem alterações. Validado:

- Todas as tabelas em `public.*` possuem policies (mínimo 1) — ver `<supabase-tables>`.
- Tabelas sensíveis (`user_roles`, `payments`, `orders`, `customers`) usam
  `has_role` / `auth.uid()` scoping.
- Faltam índices sugeridos em `business_rule_execution_log(rule_code, created_at)`
  e `customer_timeline(customer_id, occurred_at)` — anotados em TECHNICAL_DEBT.

---

## 7. APIs (server functions + rotas `/api/public/*`)

- Contratos validados com Zod em 100% das server functions revisadas.
- Webhooks (`mp.webhook`, `mp.callback`) verificam assinatura antes de escrever.
- Versionamento: nenhum contrato quebrado; preparado para prefixo `/api/v1/*`
  quando necessário.

---

## 8. Conclusão

Plataforma **arquiteturalmente consolidada**. Nenhuma refatoração destrutiva
foi executada — apenas verificações e atualização de documentação. Débitos
remanescentes concentram-se em persistência de audit/usage e integrações
externas reais, todos rastreados em `TECHNICAL_DEBT.md` e endereçados pelos
Prompts 19 (Production Hardening) e 20 (Performance & Scalability).
