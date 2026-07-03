import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FinancePeriod } from "@/lib/finance";

export function FinancialFilters({
  period,
  onPeriodChange,
}: {
  period: FinancePeriod;
  onPeriodChange: (p: FinancePeriod) => void;
}) {
  return (
    <Tabs value={period} onValueChange={(v) => onPeriodChange(v as FinancePeriod)}>
      <TabsList>
        <TabsTrigger value="today">Hoje</TabsTrigger>
        <TabsTrigger value="week">Semana</TabsTrigger>
        <TabsTrigger value="month">Mês</TabsTrigger>
        <TabsTrigger value="year">Ano</TabsTrigger>
        <TabsTrigger value="custom">Período</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
