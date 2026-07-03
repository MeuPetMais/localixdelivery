import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WidgetGrid, WidgetCard, WidgetHeader, WidgetEmpty } from "@/components/dashboard/WidgetPrimitives";
import {
  FinancePermissions,
  FinanceAudit,
  normalizeFilters,
  type FinanceFilters,
  type FinancePeriod,
  type FinanceRole,
  type FinanceTab,
} from "@/lib/finance";
import { FinancialFilters } from "./FinancialFilters";
import { FinancialErrorBoundary } from "./FinancialErrorBoundary";
import { ExecutiveKpisWidget } from "./widgets/ExecutiveKpisWidget";
import { FinancialNotificationsWidget } from "./widgets/FinancialNotificationsWidget";

const TAB_LABELS: Record<FinanceTab, string> = {
  summary: "Resumo",
  cashflow: "Fluxo de caixa",
  receivables: "Recebimentos",
  payables: "Pagamentos",
  dre: "DRE",
  profitability: "Lucratividade",
  reports: "Relatórios",
};

export function FinancialWorkspace({
  restaurantId,
  role = "ADMIN",
}: {
  restaurantId: string;
  role?: FinanceRole;
}) {
  const [period, setPeriod] = useState<FinancePeriod>("month");
  const [tab, setTab] = useState<FinanceTab>("summary");
  const filters: Partial<FinanceFilters> = useMemo(() => normalizeFilters({ period }), [period]);
  const allowedTabs = FinancePermissions.tabsFor(role);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FinancialFilters period={period} onPeriodChange={(p) => {
          setPeriod(p);
          FinanceAudit.emit({ type: "PERIOD_CHANGE", restaurantId, payload: { period: p } });
        }} />
      </div>

      <Tabs value={tab} onValueChange={(v) => {
        const next = v as FinanceTab;
        setTab(next);
        FinanceAudit.emit({ type: "TAB_CHANGE", restaurantId, payload: { tab: next } });
      }}>
        <TabsList className="flex-wrap">
          {allowedTabs.map((t) => (
            <TabsTrigger key={t} value={t}>{TAB_LABELS[t]}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-4">
          <FinancialErrorBoundary>
            <WidgetGrid>
              <ExecutiveKpisWidget restaurantId={restaurantId} filters={filters} />
              <FinancialNotificationsWidget restaurantId={restaurantId} />
            </WidgetGrid>
          </FinancialErrorBoundary>
        </TabsContent>

        {(["cashflow", "receivables", "payables", "dre", "profitability", "reports"] as FinanceTab[]).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <FinancialErrorBoundary>
              <WidgetCard span={4}>
                <WidgetHeader title={TAB_LABELS[t]} />
                <WidgetEmpty description="Em breve — módulo será plugado ao FinancialDashboardService." />
              </WidgetCard>
            </FinancialErrorBoundary>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
