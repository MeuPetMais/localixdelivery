// Cash Flow / Receivables / Payables / Projection services.
//
// Port-based, side-effect free. UI never queries the DB; it calls these
// services which delegate to `cashflow.functions` (RLS-scoped) and to the
// existing LedgerService, SplitService, ReconciliationService, Purchasing
// and NotificationCenter.

import type { AccountPayable, AccountReceivable } from "./cashflow.functions";

// ---------- Ports ----------

export interface ReceivablesPort {
  list(input: { restaurantId: string; from?: string; to?: string; status?: string }): Promise<AccountReceivable[]>;
}

export interface PayablesPort {
  list(input: { restaurantId: string; from?: string; to?: string; status?: string }): Promise<AccountPayable[]>;
}

export interface LedgerStatementPort {
  getStatement(input: { restaurantId: string; from?: string; to?: string }):
    Promise<Array<{ transaction_type: string; amount: number; status: string; created_at: string }>>;
  getBalance(input: { restaurantId: string }):
    Promise<{ balance: number; currency: string; pendingIn?: number; pendingOut?: number }>;
}

export interface CashFlowPorts {
  ledger: LedgerStatementPort;
  receivables: ReceivablesPort;
  payables: PayablesPort;
}

// ---------- Aggregates ----------

export interface CashFlowPoint {
  date: string; // YYYY-MM-DD
  inflow: number;
  outflow: number;
  net: number;
  runningBalance: number;
}

export interface CashFlowSummary {
  balance: number;
  today: { inflow: number; outflow: number };
  period: { inflow: number; outflow: number; net: number };
  timeline: CashFlowPoint[];
  currency: string;
}

export interface ReceivablesSummary {
  pending: number;
  overdue: number;
  received: number;
  next7: number;
  next30: number;
  items: AccountReceivable[];
}

export interface PayablesSummary {
  open: number;
  overdue: number;
  paid: number;
  next7: number;
  next30: number;
  items: AccountPayable[];
}

export interface FinancialProjection {
  projectedBalance: number;
  projectedInflow: number;
  projectedOutflow: number;
  workingCapital: number;
  horizonDays: number;
}

// ---------- Helpers ----------

const REVENUE = new Set(["RESTAURANT_RECEIVABLE", "PAYMENT_APPROVED"]);
const FEES = new Set(["PLATFORM_FEE", "GATEWAY_FEE", "PAYOUT", "REFUND"]);

function dayKey(iso: string): string { return iso.slice(0, 10); }
function todayKey(): string { return new Date().toISOString().slice(0, 10); }
function addDays(base: Date, days: number): Date { const d = new Date(base); d.setDate(d.getDate() + days); return d; }

// ---------- Services ----------

export class CashFlowService {
  constructor(private readonly ports: CashFlowPorts) {}

  async getSummary(input: { restaurantId: string; from: string; to: string }): Promise<CashFlowSummary> {
    const [rows, balance] = await Promise.all([
      this.ports.ledger.getStatement({ restaurantId: input.restaurantId, from: input.from, to: input.to }),
      this.ports.ledger.getBalance({ restaurantId: input.restaurantId }),
    ]);
    const today = todayKey();
    const buckets = new Map<string, { inflow: number; outflow: number }>();
    let periodIn = 0, periodOut = 0, todayIn = 0, todayOut = 0;

    for (const r of rows) {
      if (r.status !== "COMPLETED") continue;
      const key = dayKey(r.created_at);
      const b = buckets.get(key) ?? { inflow: 0, outflow: 0 };
      const amt = Math.abs(Number(r.amount) || 0);
      if (REVENUE.has(r.transaction_type)) {
        b.inflow += amt; periodIn += amt; if (key === today) todayIn += amt;
      } else if (FEES.has(r.transaction_type)) {
        b.outflow += amt; periodOut += amt; if (key === today) todayOut += amt;
      }
      buckets.set(key, b);
    }

    const sortedKeys = Array.from(buckets.keys()).sort();
    let running = balance.balance - (periodIn - periodOut);
    const timeline: CashFlowPoint[] = sortedKeys.map((date) => {
      const b = buckets.get(date)!;
      const net = b.inflow - b.outflow;
      running += net;
      return { date, inflow: b.inflow, outflow: b.outflow, net, runningBalance: running };
    });

    return {
      balance: balance.balance,
      currency: balance.currency,
      today: { inflow: todayIn, outflow: todayOut },
      period: { inflow: periodIn, outflow: periodOut, net: periodIn - periodOut },
      timeline,
    };
  }
}

export class ReceivablesService {
  constructor(private readonly ports: Pick<CashFlowPorts, "receivables">) {}

  async getSummary(input: { restaurantId: string; from: string; to: string }): Promise<ReceivablesSummary> {
    const items = await this.ports.receivables.list({
      restaurantId: input.restaurantId, from: input.from, to: input.to,
    });
    const today = todayKey();
    const in7 = addDays(new Date(), 7).toISOString().slice(0, 10);
    const in30 = addDays(new Date(), 30).toISOString().slice(0, 10);

    let pending = 0, overdue = 0, received = 0, next7 = 0, next30 = 0;
    for (const r of items) {
      const amt = Number(r.net_amount) || 0;
      if (r.status === "RECEIVED") received += amt;
      else if (r.status === "PENDING") {
        pending += amt;
        const due = r.expected_date ?? "";
        if (due && due < today) overdue += amt;
        if (due && due >= today && due <= in7) next7 += amt;
        if (due && due >= today && due <= in30) next30 += amt;
      }
    }
    return { pending, overdue, received, next7, next30, items };
  }
}

export class PayablesService {
  constructor(private readonly ports: Pick<CashFlowPorts, "payables">) {}

  async getSummary(input: { restaurantId: string; from: string; to: string }): Promise<PayablesSummary> {
    const items = await this.ports.payables.list({
      restaurantId: input.restaurantId, from: input.from, to: input.to,
    });
    const today = todayKey();
    const in7 = addDays(new Date(), 7).toISOString().slice(0, 10);
    const in30 = addDays(new Date(), 30).toISOString().slice(0, 10);

    let open = 0, overdue = 0, paid = 0, next7 = 0, next30 = 0;
    for (const p of items) {
      const remaining = Math.max(0, (Number(p.amount) || 0) - (Number(p.paid_amount) || 0));
      if (p.status === "PAID") paid += Number(p.amount) || 0;
      else if (p.status === "CANCELLED") continue;
      else {
        open += remaining;
        const due = p.due_date ?? "";
        if (p.status === "OVERDUE" || (due && due < today)) overdue += remaining;
        if (due && due >= today && due <= in7) next7 += remaining;
        if (due && due >= today && due <= in30) next30 += remaining;
      }
    }
    return { open, overdue, paid, next7, next30, items };
  }
}

export class FinancialProjectionService {
  constructor(
    private readonly cashflow: CashFlowService,
    private readonly receivables: ReceivablesService,
    private readonly payables: PayablesService,
  ) {}

  async project(input: { restaurantId: string; from: string; to: string; horizonDays: number }): Promise<FinancialProjection> {
    const [flow, ar, ap] = await Promise.all([
      this.cashflow.getSummary(input),
      this.receivables.getSummary(input),
      this.payables.getSummary(input),
    ]);
    const projectedInflow = input.horizonDays <= 7 ? ar.next7 : ar.next30;
    const projectedOutflow = input.horizonDays <= 7 ? ap.next7 : ap.next30;
    return {
      projectedBalance: flow.balance + projectedInflow - projectedOutflow,
      projectedInflow,
      projectedOutflow,
      workingCapital: ar.pending - ap.open,
      horizonDays: input.horizonDays,
    };
  }
}
