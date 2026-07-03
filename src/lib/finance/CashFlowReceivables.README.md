# Cash Flow & Receivables

Read-mostly module on top of the Finance Domain foundation.

## Reused (not recreated)

| Concern            | Owner                                   |
| ------------------ | --------------------------------------- |
| Movements / balance| `LedgerService` (`src/lib/ledger`)      |
| Split / recon      | `SplitService`, `ReconciliationService` |
| Costs              | `CostEngine`                            |
| Purchasing         | `PurchasingService`, `ReceivingService` |
| Notifications      | `NotificationCenter`                    |
| Widget primitives  | `src/components/dashboard/WidgetPrimitives` |
| Finance shell      | `RestaurantFinancialCenter`, `FinancialWorkspace` |

## Added

### Tables
- `accounts_receivable` — PENDING / RECEIVED / FAILED / CANCELLED.
- `accounts_payable` — OPEN / PARTIAL / PAID / OVERDUE / CANCELLED.
- Owner-scoped RLS via `restaurants.owner_id`. `updated_at` trigger reuses `tg_set_updated_at`.

### Services (pure orchestration, port-based, no SQL)
- `CashFlowService` — consolidates ledger movements into daily inflow/outflow, today bucket, timeline, running balance.
- `ReceivablesService` — pending / overdue / received / next 7 / next 30.
- `PayablesService` — open / overdue / paid / next 7 / next 30.
- `FinancialProjectionService` — 7-day / 30-day projections + working capital.

### Server functions (RLS-scoped)
- `listReceivables`, `createReceivable`, `updateReceivableStatus`
- `listPayables`, `createPayable`, `updatePayableStatus`

### UI
- `CashFlowWidget` — today, period, balance, timeline.
- `ReceivablesWidget`, `PayablesWidget` — buckets and horizons.
- Plugged into `FinancialWorkspace` under **Fluxo de caixa / Recebimentos / Pagamentos** tabs.

## Rules

- No frontend arithmetic; every value comes from a service.
- Ledger is **read-only** — cash flow never rewrites `financial_ledger`.
- Each widget owns its own error boundary.
- All accessors go through `requireSupabaseAuth`; RLS applies as the owner.

## Pending (next prompt)
- Financial Calendar view.
- Wire NotificationCenter alerts for overdue payables / late receivables.
- Recurring bills.
