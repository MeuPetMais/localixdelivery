import type { FinanceFilters, FinancePeriod } from "./types";

export function resolvePeriod(period: FinancePeriod, now: Date = new Date()): { from: string; to: string } {
  const to = new Date(now);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (period === "today") { /* from = start of today */ }
  else if (period === "week") {
    const dow = from.getDay();
    from.setDate(from.getDate() - dow);
  } else if (period === "month") {
    from.setDate(1);
  } else if (period === "year") {
    from.setMonth(0, 1);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export function normalizeFilters(f: Partial<FinanceFilters>): FinanceFilters {
  const period = f.period ?? "month";
  if (period === "custom" && f.from && f.to) {
    return { ...f, period, from: f.from, to: f.to };
  }
  const range = resolvePeriod(period);
  return { ...f, period, from: range.from, to: range.to };
}
