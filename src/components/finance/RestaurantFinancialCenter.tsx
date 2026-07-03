import { useEffect, useState } from "react";
import { FinanceDomain, FinanceAudit, type FinanceRole, type FinanceStatus } from "@/lib/finance";
import { FinancialWorkspace } from "./FinancialWorkspace";
import { FinancialStatusBar } from "./FinancialStatus";
import { FinancialErrorBoundary } from "./FinancialErrorBoundary";

const service = FinanceDomain.createDashboardService();

export function RestaurantFinancialCenter({
  restaurantId,
  role = "ADMIN",
}: {
  restaurantId: string;
  role?: FinanceRole;
}) {
  const [status, setStatus] = useState<FinanceStatus | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    FinanceAudit.emit({ type: "VIEW", restaurantId });
    let cancel = false;
    service.getStatus({ restaurantId })
      .then(s => { if (!cancel) setStatus(s); })
      .catch(() => { if (!cancel) setStatus(null); });
    return () => { cancel = true; };
  }, [restaurantId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Central Financeira</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada de receitas, custos, split e conciliação.
        </p>
      </div>
      <FinancialStatusBar status={status} />
      <FinancialErrorBoundary>
        <FinancialWorkspace restaurantId={restaurantId} role={role} />
      </FinancialErrorBoundary>
    </div>
  );
}
