// FinancialDashboardService — consolidator only.
//
// Never accesses the database directly. Delegates to existing services:
//   - LedgerService (statement, balance)
//   - PricingEngine (via snapshots/order pricing already recorded)
//   - CostEngine   (profitability)
//   - SplitService / ReconciliationService (status)
//
// UI components read from here; here we call the ports below. Ports are
// injected so the service is trivially testable without importing servers.

import type { ExecutiveKPIs, FinanceFilters, FinanceStatus } from "./types";
import { normalizeFilters } from "./FinanceFilters";

export interface LedgerViewInput {
  restaurantId: string;
  from?: string;
  to?: string;
}

export interface LedgerPort {
  getSnapshot?(input: LedgerViewInput): Promise<{
    rows: Awaited<ReturnType<LedgerPort["getStatement"]>>;
    balance: Awaited<ReturnType<LedgerPort["getBalance"]>>;
  }>;
  getStatement(input: { restaurantId: string; from?: string; to?: string }): Promise<
    Array<{
      transaction_type: string;
      amount: number;
      order_id?: string | null;
      status: string;
      currency?: string;
      created_at: string;
    }>
  >;
  getBalance(input: {
    restaurantId: string;
  }): Promise<{ balance: number; currency: string; pendingIn?: number; pendingOut?: number }>;
}

export interface CostPort {
  getPeriodProfitability(input: {
    restaurantId: string;
    from: string;
    to: string;
  }): Promise<{ cmv: number; grossProfit: number; netProfit: number; marginPct: number }>;
}

export interface ReconciliationPort {
  getLastReconciliation(input: {
    restaurantId: string;
  }): Promise<{ at?: string; status?: string } | null>;
}

export interface SplitPort {
  getLastSplit(input: { restaurantId: string }): Promise<{ at?: string; status?: string } | null>;
}

export interface PaymentPort {
  getActiveGateway(input: { restaurantId: string }): Promise<{ provider?: string } | null>;
}

export interface FinancialDashboardPorts {
  ledger: LedgerPort;
  cost?: CostPort;
  reconciliation?: ReconciliationPort;
  split?: SplitPort;
  payment?: PaymentPort;
}

const APPROVED = new Set(["COMPLETED"]);
const REVENUE_TYPES = new Set(["RESTAURANT_RECEIVABLE", "PAYMENT_APPROVED"]);
const FEE_TYPES = new Set(["PLATFORM_FEE", "GATEWAY_FEE"]);

export class FinancialDashboardService {
  constructor(private readonly ports: FinancialDashboardPorts) {}

  async getExecutiveKPIs(input: {
    restaurantId: string;
    filters?: Partial<FinanceFilters>;
  }): Promise<ExecutiveKPIs> {
    const filters = normalizeFilters(input.filters ?? {});
    const { rows, balance } = await readLedgerView(this.ports.ledger, {
      restaurantId: input.restaurantId,
      from: filters.from,
      to: filters.to,
    });

    let grossRevenue = 0;
    let fees = 0;
    let pendingReceivables = 0;
    let pendingPayables = 0;
    const orderIds = new Set<string>();

    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      const approved = APPROVED.has(r.status);
      if (REVENUE_TYPES.has(r.transaction_type) && approved) {
        if (!r.order_id) {
          throw new Error(
            "Indicador de pedidos indisponível: lançamento financeiro sem pedido vinculado.",
          );
        }
        grossRevenue += amt;
        orderIds.add(r.order_id);
      }
      if (FEE_TYPES.has(r.transaction_type) && approved) {
        fees += Math.abs(amt);
      }
      if (r.status === "PENDING") {
        if (REVENUE_TYPES.has(r.transaction_type)) pendingReceivables += amt;
        else if (r.transaction_type === "PAYOUT" || FEE_TYPES.has(r.transaction_type))
          pendingPayables += Math.abs(amt);
      }
    }

    const orders = orderIds.size;
    const netRevenue = grossRevenue - fees;
    const currency = balance.currency ?? "BRL";
    const cost = this.ports.cost
      ? await this.ports.cost
          .getPeriodProfitability({
            restaurantId: input.restaurantId,
            from: filters.from!,
            to: filters.to!,
          })
          .catch(() => null)
      : null;

    const cmv = cost?.cmv ?? 0;
    const grossProfit = cost?.grossProfit ?? netRevenue - cmv;
    const netProfit = cost?.netProfit ?? grossProfit;
    const marginPct = cost?.marginPct ?? (grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0);

    return {
      grossRevenue,
      netRevenue,
      grossProfit,
      netProfit,
      cmv,
      marginPct,
      orders,
      averageTicket: orders > 0 ? grossRevenue / orders : 0,
      currentBalance: balance.balance,
      pendingReceivables: balance.pendingIn ?? pendingReceivables,
      pendingPayables: balance.pendingOut ?? pendingPayables,
      currency,
    };
  }

  async getStatus(input: { restaurantId: string }): Promise<FinanceStatus> {
    const [balance, recon, split, gw] = await Promise.all([
      this.ports.ledger.getBalance({ restaurantId: input.restaurantId }),
      this.ports.reconciliation?.getLastReconciliation({ restaurantId: input.restaurantId }) ??
        null,
      this.ports.split?.getLastSplit({ restaurantId: input.restaurantId }) ?? null,
      this.ports.payment?.getActiveGateway({ restaurantId: input.restaurantId }) ?? null,
    ]);
    return {
      lastReconciliationAt: recon?.at,
      lastSplitAt: split?.at,
      lastUpdatedAt: new Date().toISOString(),
      activeGateway: gw?.provider,
      balance: balance.balance,
      currency: balance.currency ?? "BRL",
    };
  }
}

/** Production ports implement getSnapshot; legacy injected test ports retain compatibility. */
export async function readLedgerView(
  ledger: LedgerPort,
  input: { restaurantId: string; from?: string; to?: string },
) {
  if (ledger.getSnapshot) return ledger.getSnapshot(input);
  const [rows, balance] = await Promise.all([
    ledger.getStatement(input),
    ledger.getBalance({ restaurantId: input.restaurantId }),
  ]);
  return { rows, balance };
}
