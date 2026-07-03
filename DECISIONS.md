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

## Prompt 14 — Platform Administration Domain

- Domínio implementado como camada de serviços puros; nenhuma migration
  adicionada para evitar retrabalho quando as tabelas dedicadas
  (`platform_audit_log`, `platform_incidents`, `platform_notifications`,
  `platform_moderation_events`) forem projetadas em conjunto com o
  Prompt 15.
- RBAC administrativo é aditivo: continua exigindo `has_role('admin')`
  nas server-functions; os 6 papéis novos são camada extra de
  autorização in-domain.
- Catálogo de planos vive em código (fonte-única determinística); overrides
  poderão ser persistidos em `platform_settings` sem quebrar consumidores.

## Prompt 15 — Platform Configuration & Feature Flag System

- Configuração global fica **fora** do `TenantConfigurationService` para
  preservar isolamento por tenant: TenantConfig continua RLS-scoped por
  restaurante; PlatformConfig é global/plano/ambiente/canal.
- Rollout gradual usa hash FNV-1a determinístico sobre
  `${flagKey}:${bucketKey}` para garantir estabilidade entre chamadas e
  distribuição uniforme.
- Kill switch é dimensão ortogonal ao status da flag — quando ativo, força
  desligado independentemente de targeting/default/rollout.
- Histórico e auditoria são append-only (`Object.freeze`) para impedir
  reescrita de decisões passadas.
- Sem migrations neste prompt: os repositórios in-memory são substituíveis
  por implementações Supabase quando as tabelas dedicadas forem projetadas
  junto com o Prompt 16.
