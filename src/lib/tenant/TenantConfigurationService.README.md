# Tenant Configuration Service

Camada SaaS multi-tenant do Localix. Cada restaurante possui seus próprios
grupos de configuração (`payment`, `delivery`, `business`, `branding`,
`notifications`, `features`). Nenhuma regra deve ficar hardcoded — tudo passa
pelo `TenantConfigurationService`.

Este módulo é aditivo. Não modifica OAuth, PricingEngine, Checkout,
PaymentIntent, WebhookService, FinancialLedger, ReconciliationService,
SplitService, OrderOrchestrator, BusinessRulesEngine, NotificationCenter,
DeliveryEngine nem o EventBus.

## Arquitetura

```
Restaurant → TenantConfigurationService → BusinessRulesEngine
                                        → PricingEngine
                                        → NotificationCenter
                                        → DeliveryEngine
                                        → Checkout
```

Um único ponto de leitura, plugável por injeção nos serviços que precisarem
consultar as configurações do tenant.

## Componentes

- `TenantConfigurationService` — fachada (get, getGroup, validate, update, rollback, invalidate).
- `TenantConfigurationCache` — cache em memória com TTL (padrão 30s) por restaurante.
- `TenantConfigurationValidator` — regras de validação por grupo (mínimos, máximos, horários, gateway, cores, canais).
- `TenantConfigurationVersioning` — histórico versionado por grupo + rollback.
- `TenantAudit` — diff campo a campo (valor anterior/novo, autor, origem).
- `types.ts` — `DEFAULT_CONFIG` + tipos por grupo.

## Fluxo de update

1. `validate(group, value)` — se inválido, retorna `{ ok: false, issues }`.
2. `repo.saveGroup(...)` — persistência (implementação sob Supabase é a integração).
3. `repo.bumpVersion(...)` — incrementa `configuration_version` do tenant.
4. `versioning.record(...)` — snapshot no histórico.
5. `audit.diff(...)` — grava diff campo a campo em `tenant_config_audit`.
6. `cache.invalidate(...)` — próximo `get` recarrega dados.

## Rollback

`service.rollback(restaurantId, group, version)` restaura o snapshot da versão
alvo, revalida sob as regras atuais e chama `update` normalmente (nova entrada
de versão + auditoria).

## Cache

- TTL padrão 30s em memória.
- `invalidate(restaurantId)` após qualquer mutação.
- Instância singleton `tenantConfigCache` para uso da aplicação; testes usam
  instâncias próprias.

## Tabelas

- `tenant_configuration` (header: versão e status)
- `tenant_payment_settings`, `tenant_delivery_settings`,
  `tenant_business_settings`, `tenant_branding`, `tenant_notifications`,
  `tenant_features`
- `tenant_config_versions` (snapshots por grupo)
- `tenant_config_audit` (diff campo a campo)

RLS: admin veem tudo; dono do restaurante vê/edita apenas o próprio; service_role acesso total.

## Integrações (contratos)

- **BusinessRulesEngine**: `svc.getGroup(rid, "business" | "payment" | ...)` no `context` antes de `evaluate`.
- **PricingEngine**: `svc.getGroup(rid, "payment")` para pedido mínimo, frete e gateway padrão.
- **NotificationCenter**: `svc.getGroup(rid, "notifications")` para canais e opt-ins.
- **DeliveryEngine**: `svc.getGroup(rid, "delivery")` para modo, raio, tempos, atribuição.
- **Checkout**: `svc.getGroup(rid, "payment")` para métodos aceitos e mínimo do pedido.

Nenhuma integração é ativada automaticamente — cada consumidor deve chamar o
service quando desejar. Isso preserva a compatibilidade dos módulos atuais.

## Como adicionar um novo grupo

1. Criar tabela `tenant_<grupo>_settings` na migração (mesmo padrão de RLS).
2. Adicionar tipo + valores default em `types.ts` (`ConfigGroup`, `GroupPayload`, `DEFAULT_CONFIG`).
3. Estender `validateGroup` com regras específicas.
4. Estender o repositório real (`loadAll`, `saveGroup`).
5. Consumidores acessam via `svc.getGroup(rid, "<grupo>")`.

## Testes

`TenantConfigurationService.test.ts` cobre validação, cache (hit/expira),
service (get/update/rollback), versionamento e auditoria — 15 casos.

## Pendências para produção

- Repositório real `TenantConfigRepository` sobre Supabase.
- Painel do restaurante em abas (Geral, Pagamentos, Entrega, Horários, Notificações, Identidade Visual, Funcionalidades).
- Painel admin com histórico + rollback.
- Wire dos consumidores (BusinessRulesEngine, PricingEngine, NotificationCenter, DeliveryEngine, Checkout).
- Distribuição de cache (Redis / KV) para múltiplas instâncias.
