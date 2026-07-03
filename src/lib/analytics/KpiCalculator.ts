import type { KpiFormat, KpiTrend, KpiValue, AnalyticsScope } from "./types";

export const KpiCalculator = {
  build(input: {
    key: string; label: string; value: number; scope: AnalyticsScope;
    format?: KpiFormat; previous?: number;
  }): KpiValue {
    const format = input.format ?? "number";
    const previous = input.previous;
    let delta: number | undefined;
    let deltaPct: number | undefined;
    let trend: KpiTrend | undefined;
    if (typeof previous === "number") {
      delta = input.value - previous;
      deltaPct = previous === 0 ? (input.value === 0 ? 0 : 100) : (delta / previous) * 100;
      trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    }
    return {
      key: input.key,
      label: input.label,
      value: Math.round(input.value * 100) / 100,
      format,
      previous: previous != null ? Math.round(previous * 100) / 100 : undefined,
      delta: delta != null ? Math.round(delta * 100) / 100 : undefined,
      deltaPct: deltaPct != null ? Math.round(deltaPct * 100) / 100 : undefined,
      trend,
      scope: input.scope,
    };
  },
  safeDiv(a: number, b: number): number {
    return b === 0 ? 0 : a / b;
  },
};
