import { dashboardBalance } from "./dashboard-balance";
// Finance Domain — extended with CashFlow / Receivables / Payables / Projection.
// Composes real ports bound to LedgerService server functions and the
// cashflow.functions accessors (RLS-scoped).

import {
  FinancialDashboardService,
  type FinancialDashboardPorts,
  type LedgerPort,
} from "./FinancialDashboardService";
import {
  CashFlowService,
  ReceivablesService,
  PayablesService,
  FinancialProjectionService,
  type CashFlowPorts,
  type ReceivablesPort,
  type PayablesPort,
  type LedgerStatementPort,
} from "./CashFlowService";
import {
  getRestaurantFinancialSnapshot,
  getRestaurantFinancialStatement,
  getRestaurantBalance,
} from "@/lib/ledger/LedgerService";
import { listReceivables, listPayables } from "./cashflow.functions";

const ledgerPort: LedgerPort & LedgerStatementPort = {
  async getSnapshot(input) {
    const snapshot = await getRestaurantFinancialSnapshot({ data: input });
    return { rows: snapshot.rows, balance: dashboardBalance(snapshot.balance) };
  },
  async getStatement({ restaurantId, from, to }) {
    const rows = await getRestaurantFinancialStatement({
      data: { restaurantId, from, to },
    });
    return rows ?? [];
  },
  async getBalance({ restaurantId }) {
    const b = await getRestaurantBalance({ data: { restaurantId } });
    return dashboardBalance(b);
  },
};

const receivablesPort: ReceivablesPort = {
  async list({ restaurantId, from, to, status }) {
    return await listReceivables({ data: { restaurantId, from, to, status } });
  },
};

const payablesPort: PayablesPort = {
  async list({ restaurantId, from, to, status }) {
    return await listPayables({ data: { restaurantId, from, to, status } });
  },
};

export const FinanceDomain = {
  createDashboardService(portsOverride?: Partial<FinancialDashboardPorts>) {
    return new FinancialDashboardService({
      ledger: portsOverride?.ledger ?? ledgerPort,
      cost: portsOverride?.cost,
      reconciliation: portsOverride?.reconciliation,
      split: portsOverride?.split,
      payment: portsOverride?.payment,
    });
  },
  createCashFlowService(portsOverride?: Partial<CashFlowPorts>) {
    return new CashFlowService({
      ledger: portsOverride?.ledger ?? ledgerPort,
      receivables: portsOverride?.receivables ?? receivablesPort,
      payables: portsOverride?.payables ?? payablesPort,
    });
  },
  createReceivablesService(port: ReceivablesPort = receivablesPort) {
    return new ReceivablesService({ receivables: port });
  },
  createPayablesService(port: PayablesPort = payablesPort) {
    return new PayablesService({ payables: port });
  },
  createProjectionService(portsOverride?: Partial<CashFlowPorts>) {
    const cf = this.createCashFlowService(portsOverride);
    const rs = this.createReceivablesService(portsOverride?.receivables);
    const ps = this.createPayablesService(portsOverride?.payables);
    return new FinancialProjectionService(cf, rs, ps);
  },
};

export { FinancialDashboardService } from "./FinancialDashboardService";
export { CashFlowService, ReceivablesService, PayablesService, FinancialProjectionService };
