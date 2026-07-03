# Financial Center Foundation

Read-only orchestration layer for the Restaurant Financial Center.
This module **does not** compute money and **does not** touch the database.
Every value comes from existing services.

## Reused (not recreated)

| Concern            | Owner                                   |
| ------------------ | --------------------------------------- |
| Movements / balance| `LedgerService` (`src/lib/ledger`)      |
| Fees / totals      | `PricingEngine` (`src/lib/payments`)    |
| Reconciliation     | `ReconciliationService`                 |
| Split              | `SplitService`                          |
| Payments / gateway | `PaymentService`, `PaymentIntent`       |
| Cost / margin      | `CostEngine`, `ProfitabilityEngine`     |
| Notifications      | `NotificationCenter` (`src/lib/notifications`) |
| Widget primitives  | `src/components/dashboard/WidgetPrimitives` |

## Added

- `FinanceDomain` — composes ports for the dashboard.
- `FinancialDashboardService` — consolidator (ports: ledger, cost, split, reconciliation, payment).
- `FinancePermissions` — role → tab matrix (ADMIN, MANAGER, FINANCE, ACCOUNTANT, VIEWER).
- `FinanceFilters` — period resolution (today/week/month/year/custom).
- `FinanceWidgetRegistry` — pluggable widgets keyed by tab + role.
- `FinanceAudit` — in-memory audit bus for views / filters / exports.
- UI: `RestaurantFinancialCenter`, `FinancialWorkspace`, `FinancialFilters`,
  `FinancialStatus`, `ExecutiveKpisWidget`, `FinancialNotificationsWidget`.

## Architecture

```
RestaurantDashboard
  └── RestaurantFinancialCenter
        └── FinancialWorkspace (tabs)
              └── FinancialDashboardService (consolidator, port-based)
                    ├── LedgerService
                    ├── CostEngine
                    ├── ReconciliationService
                    ├── SplitService
                    └── PaymentService
```

## Rules

- Frontend never runs financial arithmetic; it reads the consolidated
  `ExecutiveKPIs` and `FinanceStatus`.
- Each widget owns its own error boundary — one failure never crashes the page.
- All access to the ledger goes through server functions (`requireSupabaseAuth`).
