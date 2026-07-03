import type { AnalyticsInsight, AnalyticsScope, InsightSeverity, InsightSource } from "./types";

/** Central aggregator: consumes insights already produced by other domains. */
export const InsightsAggregator = {
  fromRaw(input: {
    source: InsightSource;
    severity?: InsightSeverity;
    title: string;
    description?: string;
    scope: AnalyticsScope;
    restaurantId?: string;
    metadata?: Record<string, unknown>;
    at?: string;
  }): AnalyticsInsight {
    return {
      id: `${input.source}:${input.title}:${input.at ?? Date.now()}`,
      source: input.source,
      severity: input.severity ?? "info",
      title: input.title,
      description: input.description,
      scope: input.scope,
      restaurantId: input.restaurantId,
      metadata: input.metadata,
      generatedAt: input.at ?? new Date().toISOString(),
    };
  },
  rank(insights: AnalyticsInsight[]): AnalyticsInsight[] {
    const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, success: 2, info: 3 };
    return [...insights].sort((a, b) => order[a.severity] - order[b.severity]);
  },
  filterBy(insights: AnalyticsInsight[], predicate: (i: AnalyticsInsight) => boolean) {
    return insights.filter(predicate);
  },
};
