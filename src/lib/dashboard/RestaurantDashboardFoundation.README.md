# Restaurant Dashboard Foundation

Fundação modular e escalável para o Dashboard do Restaurante do Localix.

## Princípios

- **Somente Services**: nenhum componente React consulta o banco. Todos
  os dados fluem pelos Services existentes (`TenantConfigurationService`,
  `NotificationCenter`, `DeliveryEngine`, `OrderOrchestrator`, etc.),
  encapsulados pelo `DashboardService`.
- **Módulos existentes intocados**: OAuth, PaymentService, PricingEngine,
  Checkout, OrderOrchestrator, BusinessRulesEngine, NotificationCenter,
  DeliveryEngine, TenantConfigurationService, EventBus, FinancialLedger,
  Reconciliation e SplitService não sofrem alteração.
- **Widget-first**: toda unidade visual de dados é um widget registrado.

## Arquitetura

```
Restaurant Dashboard
├── RestaurantDashboardLayout   (header + workspace + sidebar + main)
├── DashboardHeader             (nome, status, busca, notif., avatar)
├── RestaurantWorkspace         (Operação, Financeiro, Produtos, ...)
├── RestaurantNavigation        (sidebar, filtrada por permissões)
├── QuickActions                (atalhos operacionais)
├── GlobalSearch                (busca pedidos/clientes/produtos/...)
├── CommandPalette              (CTRL+K)
├── Breadcrumb
└── Widgets
    ├── WidgetRegistry          (registro global de widgets)
    ├── WidgetGrid/Card/Header/Footer/Loading/Error/Empty
    ├── WidgetErrorBoundary     (isolamento por widget)
    ├── NotificationWidget      (consome NotificationCenter)
    └── RestaurantStatusWidget  (consome TenantConfigurationService)
```

## Permissões

`DashboardRole = ADMIN | MANAGER | ATTENDANT | CASHIER | KITCHEN | DRIVER`

Cada `NavigationItem`, `WorkspaceDefinition` e `WidgetDefinition` aceita
`requiredRoles`. As funções `canAccess`, `filterNavigation`,
`filterWorkspaces` e o `DashboardService.loadWorkspace` filtram
automaticamente.

## Workspaces

`operation` (default), `financial`, `products`, `customers`, `marketing`,
`analytics`, `settings`. O componente `RestaurantWorkspace` troca o
contexto e emite evento `WORKSPACE_CHANGE` no `DashboardAudit`.

## Theme (Branding do Tenant)

`buildDashboardCssVars(branding)` gera variáveis CSS
(`--dashboard-primary`, `--dashboard-secondary`, `--dashboard-accent`) a
partir do `TenantConfigurationService.branding`. Aplicadas via `style` no
`RestaurantDashboardLayout`.

## Como criar novos widgets

```ts
import { WidgetRegistry } from "@/lib/dashboard";
import { WidgetCard, WidgetHeader } from "@/components/dashboard/WidgetPrimitives";

WidgetRegistry.register({
  id: "orders-today",
  title: "Pedidos hoje",
  workspace: "operation",
  requiredRoles: ["ADMIN", "MANAGER", "ATTENDANT"],
  load: async (ctx) => {
    // Chame apenas Services já existentes:
    // return OrdersService.summaryToday(ctx.restaurantId);
    return { total: 0 };
  },
  render: (data) => (
    <WidgetCard>
      <WidgetHeader title="Pedidos hoje" />
      <p className="text-2xl font-bold">{(data as any).total}</p>
    </WidgetCard>
  ),
});
```

Widgets são carregados pelo `DashboardService.loadWorkspace(ctx)`, que
executa cada `load` em paralelo e captura erros individualmente
(o `WidgetErrorBoundary` faz o mesmo em runtime React).

## Auditoria

`DashboardAudit.record({ type, actorId?, restaurantId?, payload? })`
registra: `LOGIN`, `ACCESS`, `WORKSPACE_CHANGE`, `QUICK_ACTION`,
`SEARCH`, `COMMAND`. Buffer em memória (200 eventos) com
`subscribe(listener)` para integrar ao sink de auditoria persistente
existente.

## Command Palette

`CTRL+K` (ou `⌘K`) abre a paleta. Receba `commands: CommandItem[]` no
`RestaurantDashboardLayout`. Cada execução emite `COMMAND` no audit.

## Performance

- Widgets carregados sob demanda por workspace.
- `WidgetErrorBoundary` isola falhas: um widget quebrado nunca derruba
  o Dashboard.
- Layout responsivo (mobile/tablet/desktop) via Tailwind.
- Sidebar colapsável em desktop; oculta em mobile (`hidden md:block`).

## Testes

`src/lib/dashboard/DashboardService.test.ts` cobre:
registro/listagem de widgets, isolamento de erros, filtro por role,
navegação/workspaces filtrados, auditoria com subscribers, branding.

## Pendências para a próxima etapa

- Conectar `NotificationWidget` ao `NotificationCenter` real.
- Conectar `RestaurantStatusWidget` ao `TenantConfigurationService`.
- Rota `/dashboard` do restaurante consumir `RestaurantDashboardLayout`
  (opt-in, sem quebrar `_authenticated/dashboard.tsx` atual).
- Persistir `DashboardAudit` via sink existente.
- Global Search: ligar aos Services de Orders/Customers/Products/Coupons.
