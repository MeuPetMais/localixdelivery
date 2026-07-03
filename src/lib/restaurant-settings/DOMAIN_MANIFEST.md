# Restaurant Settings DOMAIN_MANIFEST

Status: **Implemented (Prompt 13.7)** — 2026-07-03. Encerra o ERP Restaurante.

## Layer map

```
src/lib/restaurant-settings/
├── types.ts
├── PermissionRegistry.ts
├── RestaurantSettingsEventBus.ts
├── EmployeeService.ts
├── AdminAuditService.ts
├── FeatureFlagService.ts
├── RestaurantSettingsService.ts     # facade
├── index.ts
├── RestaurantSettings.test.ts
├── RestaurantSettings.README.md
└── DOMAIN_MANIFEST.md
```

## Reused infrastructure

- `TenantConfigurationService` (cache, validator, versioning, audit)
- Tabelas `tenant_*`, `user_roles`, `owner_profiles`, `restaurants`
- `BusinessRulesEngine`, `NotificationCenter`, Payment/Product/Customer/
  Delivery/Finance/Inventory domains (apenas consumo via facade)

## Events

`SettingsUpdated`, `SettingsRolledBack`, `EmployeeCreated`,
`EmployeeUpdated`, `EmployeeRemoved`, `FeatureFlagChanged`.
