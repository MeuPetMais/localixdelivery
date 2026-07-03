// FinanceDomain — top-level orchestrator for the Financial Center.
//
// Does no math. Composes the FinancialDashboardService with concrete ports
// bound to existing services (LedgerService server functions and future
// CostEngine / Reconciliation / Split / Payment adapters).

import { FinancialDashboardService, type FinancialDashboardPorts, type LedgerPort } from "./FinancialDashboardService";
import { getRestaurantStatement, getRestaurantBalance } from "@/lib/ledger/LedgerService";

const ledgerPort: LedgerPort = {
  async getStatement({ restaurantId, from, to }) {
    const rows = await getRestaurantStatement({
      data: { restaurantId, from, to, limit: 500 },
    } as any);
    return (rows ?? []) as any;
  },
  async getBalance({ restaurantId }) {
    const b = await getRestaurantBalance({ data: { restaurantId } } as any);
    return {
      balance: (b as any)?.balance ?? 0,
      currency: (b as any)?.currency ?? "BRL",
      pendingIn: (b as any)?.pendingIn,
      pendingOut: (b as any)?.pendingOut,
    };
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
};

export { FinancialDashboardService } from "./FinancialDashboardService";
