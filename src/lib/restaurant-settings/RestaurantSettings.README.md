# Restaurant Settings & Administration Domain

Fecha o ERP Restaurante. Camada de administração das configurações
operacionais de cada tenant. **Zero duplicação:** reutiliza inteiramente o
`TenantConfigurationService` (cache, validator, versioning, audit) e as
tabelas `tenant_*` já existentes.

## Arquitetura

```
Painel Admin → RestaurantSettingsService → TenantConfigurationService
                                        → EmployeeService (user_roles + owner_profiles)
                                        → FeatureFlagService (grupo "features")
                                        → AdminAuditService (tenant_config_audit)
                                        → RestaurantSettingsEventBus
```

Nenhum módulo mantém configuração própria — tudo é lido através do facade
`RestaurantSettingsService.getGroup(...)`. As integrações (Payment, Product,
Customer, Delivery, Finance, Inventory, Notifications, BusinessRules) apenas
consomem esse contrato; o Prompt 13 não altera nenhum desses domínios.

## Componentes

- `RestaurantSettingsService` — facade única (get/update/rollback + acesso a
  employees, features, audit, permissions).
- `EmployeeService` — CRUD de funcionários; usa `EmployeeRepository`
  (implementação sobre `user_roles` + `owner_profiles`).
- `PermissionRegistry` — matriz papel × permissão (admin, manager, finance,
  operations, marketing, attendant, viewer).
- `FeatureFlagService` — envelopa o grupo `features` do TenantConfiguration.
- `AdminAuditService` — auditoria administrativa; diff campo a campo.
- `RestaurantSettingsEventBus` — eventos `SettingsUpdated`,
  `SettingsRolledBack`, `EmployeeCreated/Updated/Removed`,
  `FeatureFlagChanged`.

## Tabelas reutilizadas

`tenant_configuration`, `tenant_payment_settings`, `tenant_delivery_settings`,
`tenant_business_settings`, `tenant_branding`, `tenant_notifications`,
`tenant_features`, `tenant_config_versions`, `tenant_config_audit`,
`user_roles`, `owner_profiles`, `restaurants`.

Nenhuma tabela nova. RLS existente permanece: dono acessa seu restaurante,
`has_role('admin')` acessa tudo.

## Papéis e permissões

| Papel        | Escopo |
|--------------|--------|
| admin        | Tudo (inclui features + auditoria) |
| manager      | Configurações operacionais, sem finanças de escrita |
| finance      | Financeiro + auditoria |
| operations   | Pedidos, cozinha, delivery |
| marketing    | Cupons, campanhas, promoções |
| attendant    | Atendimento (pedidos, cardápio leitura) |
| viewer       | Somente leitura |

## Eventos

- `SettingsUpdated` / `SettingsRolledBack`
- `EmployeeCreated` / `EmployeeUpdated` / `EmployeeRemoved`
- `FeatureFlagChanged`

## Testes

`RestaurantSettings.test.ts` — 10 casos: PermissionRegistry, updates
validados, rollback, feature flags, employees (CRUD + eventos), audit diff.

## Pendências

- Repositórios reais (`user_roles` join `owner_profiles`) para produção.
- Wire das rotas `_authenticated/settings.tsx` no facade.
- Painel Admin de logs consolidado.
