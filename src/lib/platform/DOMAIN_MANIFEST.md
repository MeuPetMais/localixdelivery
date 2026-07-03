# Platform Administration — Domain Manifest

Painel administrativo global do Localix. Uso exclusivo pela administração
da plataforma; nenhum tenant tem acesso.

## Boundary

- **Owns**: RBAC administrativo, catálogo de planos, dashboard executivo,
  projeção de assinaturas, feature flags globais, auditoria administrativa,
  central de suporte/moderação/incidentes/notificações globais.
- **Does not own**: dados de tenants (Restaurant/ERP), pagamentos, pedidos,
  clientes, produtos — apenas projeta.
- **Does not modify**: nenhuma tabela existente; nenhum domínio existente.

## Público

- Apenas usuários com `has_role('admin')` (RBAC atual).
- Papéis internos ao domínio (`super_admin`, `platform_admin`, …) são
  camada de autorização adicional aplicada nos serviços.

## Reutilização

- `restaurants`, `orders`, `user_roles`, `customer_profiles`,
  `platform_settings`, `platform_fees`, `support_tickets`,
  `support_messages`, `reviews`
- `superadmin.functions.ts`, `admin.functions.ts`, `platform-settings.functions.ts`
- Rotas `src/routes/admin.*.tsx`

## Interfaces públicas

```ts
import {
  PlatformPermissionRegistry,
  PlanCatalogService,
  TenantAdministrationService,
  SubscriptionMonitorService,
  PlatformDashboardService,
  PlatformFeatureFlagService,
  PlatformAuditService,
  PlatformEventBus,
  SupportCenterService,
  ModerationCenterService,
  IncidentCenterService,
  GlobalNotificationCenterService,
} from "@/lib/platform";
```

## Eventos publicados

- `PlatformTenantStatusChanged`
- `PlatformPlanChanged`
- `PlatformFeatureFlagChanged`
- `PlatformAdminGranted`
- `PlatformAdminRevoked`
- `PlatformIncidentReported`

## Não-objetivos

- Não implementa cobrança/split real (delegado ao Payment Domain).
- Não implementa moderação executiva (apenas registra ação — dispatch fica
  a cargo do domínio alvo).
- Não implementa envio de notificação (delegado ao NotificationCenter).

## Débitos

- `platform_audit_log` (migration + Supabase repository) — hoje há apenas
  `InMemoryPlatformAuditRepository`.
- `platform_incidents`, `platform_notifications`, `platform_moderation_events`
  ainda não persistidos; os serviços operam sobre projeções em memória.
- Widgets de UI para os módulos novos (Planos, Assinaturas, Moderação,
  Incidentes, Notificações Globais) permanecem para o Prompt 15.
