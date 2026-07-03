# Platform Administration Domain

Painel administrativo global do Localix. Não pertence a nenhum tenant — é
usado exclusivamente pela administração da plataforma.

## Escopo

- Dashboard executivo (restaurantes, pedidos, GMV, receita, MRR, ticket médio)
- Gestão de tenants (ativar, bloquear, suspender, mudar plano)
- Catálogo de planos (Free / Starter / Pro / Enterprise)
- Monitoramento de assinaturas (projeção sobre Payment Domain existente)
- RBAC administrativo (6 papéis, matriz de permissões)
- Auditoria administrativa (diff + append-only)
- Central de Suporte, Moderação, Incidentes e Notificações Globais
- Feature Flags globais (não confundir com feature flags por tenant)

## Reutilização

Este domínio **não** cria tabelas ou migrations novas. Consome:

- `restaurants`, `orders`, `user_roles`, `customer_profiles`
- `platform_settings`, `platform_fees`
- `support_tickets`, `support_messages`, `reviews`
- Server-functions existentes: `src/lib/superadmin.functions.ts`,
  `src/lib/admin.functions.ts`, `src/lib/platform-settings.functions.ts`
- Rotas administrativas já entregues em `src/routes/admin.*.tsx`

Nenhum domínio existente (Auth, ERP, Payment, Finance, Inventory, Customer,
Product, Order, Delivery, NotificationCenter, BusinessRulesEngine,
TenantConfigurationService) é modificado.

## Arquitetura

Todos os serviços são **puros** — recebem dados crus (já filtrados por
service-role/RLS nas server-functions existentes) e produzem projeções
determinísticas. A persistência real (quando necessária, e.g. auditoria
administrativa dedicada) é plugada via repositório — hoje há apenas o
`InMemoryPlatformAuditRepository` para testes; um `SupabasePlatformAudit
Repository` deverá ser adicionado quando a tabela `platform_audit_log` for
provisionada (ver `TECHNICAL_DEBT.md`).

## Módulos

| Arquivo | Responsabilidade |
| --- | --- |
| `types.ts` | Roles, permissões, planos, tenant status, eventos |
| `PlatformPermissionRegistry.ts` | Matriz RBAC (6 papéis × permissões) |
| `PlanCatalogService.ts` | Catálogo determinístico de planos |
| `TenantAdministrationService.ts` | Diretório/summary de tenants + filtros |
| `SubscriptionMonitorService` (mesmo arquivo) | Projeção de status de assinatura |
| `PlatformDashboardService.ts` | Snapshot agregado do dashboard executivo |
| `PlatformFeatureFlagService.ts` | Flags globais (defaults + overrides) |
| `PlatformAuditService.ts` | Auditoria administrativa + diff |
| `PlatformEventBus.ts` | Barramento de eventos administrativos |
| `SupportCenterService.ts` | Suporte, moderação, incidentes, notificações globais |

## Permissões

| Papel | Escopo |
| --- | --- |
| `super_admin` | Tudo |
| `platform_admin` | Tenants, planos, config, notificações |
| `finance_admin` | Financeiro, comissões, planos (leitura) |
| `support_admin` | Suporte, moderação, incidentes, notificações |
| `operations_admin` | Tenants, monitoramento, logs, auditoria |
| `read_only` | Somente leitura |

## Eventos

Publicados via `PlatformEventBus`:

- `PlatformTenantStatusChanged`
- `PlatformPlanChanged`
- `PlatformFeatureFlagChanged`
- `PlatformAdminGranted` / `PlatformAdminRevoked`
- `PlatformIncidentReported`

## Testes

`PlatformAdministration.test.ts` cobre permissões, planos, auditoria, event
bus, dashboard, assinaturas, feature flags, suporte, moderação, incidentes e
notificações globais.

## Segurança

- Nenhuma rota nova exposta ao tenant.
- Serviços puros; toda persistência protegida por RLS + `has_role('admin')`
  nas server-functions existentes.
- MFA-ready: a matriz de permissões distingue leitura e escrita, permitindo
  exigir MFA para escritas críticas no futuro sem refatorar consumidores.
