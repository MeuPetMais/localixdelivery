// Finance Domain — shared types.
// Read-only orchestration layer. Never contains SQL or business math —
// all numbers come from FinancialLedger / PricingEngine / CostEngine /
// SplitService / ReconciliationService / PaymentService.

export type FinancePeriod = "today" | "week" | "month" | "year" | "custom";

export type FinanceRole =
  | "ADMIN"
  | "MANAGER"
  | "FINANCE"
  | "ACCOUNTANT"
  | "VIEWER";

export type FinanceTab =
  | "summary"
  | "cashflow"
  | "receivables"
  | "payables"
  | "dre"
  | "profitability"
  | "reports";

export interface FinanceFilters {
  period: FinancePeriod;
  from?: string; // ISO
  to?: string;   // ISO
  gateway?: string;
  channel?: string;
  paymentMethod?: string;
  category?: string;
}

export interface ExecutiveKPIs {
  grossRevenue: number;
  netRevenue: number;
  grossProfit: number;
  netProfit: number;
  cmv: number;
  marginPct: number;
  orders: number;
  averageTicket: number;
  currentBalance: number;
  pendingReceivables: number;
  pendingPayables: number;
  currency: string;
}

export interface FinanceStatus {
  lastReconciliationAt?: string;
  lastSplitAt?: string;
  lastUpdatedAt?: string;
  activeGateway?: string;
  balance: number;
  currency: string;
}

export interface FinanceAuditEvent {
  type:
    | "VIEW"
    | "FILTER_CHANGE"
    | "PERIOD_CHANGE"
    | "EXPORT"
    | "TAB_CHANGE";
  actorId?: string;
  restaurantId: string;
  payload?: Record<string, unknown>;
  at: string;
}
