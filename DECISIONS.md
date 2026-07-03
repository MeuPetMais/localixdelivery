# Architecture Decisions

## 2026-07-03 — Restaurant Settings Domain (Prompt 13.7)

- **Decision:** o Restaurant Settings & Administration Domain é implementado
  como camada de facade sobre o `TenantConfigurationService`, sem criar novas
  tabelas ou duplicar validação.
- **Rationale:** o serviço tenant já cobre cache, versioning, audit e
  validation. Duplicar esses componentes violaria o princípio de
  reutilização e criaria dois caminhos de escrita para as mesmas tabelas.
- **Consequences:** todo consumo de configuração passa por
  `RestaurantSettingsService.getGroup` / `updateGroup`. Módulos legados que
  ainda leem `restaurants.*` devem migrar gradualmente (ver TECHNICAL_DEBT).

## 2026-07-03 — Employee model reutiliza `user_roles` + `owner_profiles`

- **Decision:** funcionários e permissões continuam sob `user_roles`
  (SECURITY DEFINER `has_role`) com metadados em `owner_profiles`.
- **Rationale:** evita nova tabela `employees` redundante; a matriz de
  papéis vive no código (`PermissionRegistry`), o que permite iteração
  rápida sem migrations.

## 2026-07-03 — Encerramento do ERP Restaurante

- Prompt 14 (Admin Dashboard) assume a existência dos domínios
  Payments, Orders, Delivery, Inventory, Recipes, Production, Cost,
  Purchasing, Finance, Product, Customer, Restaurant Settings.
