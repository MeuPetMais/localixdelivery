import type {
  AnalyticsFilter, AnalyticsScope, DashboardSection, DashboardSnapshot,
  AnalyticsInsight, ExportFormat, ExportResult,
} from "./types";
import { SnapshotStore } from "./SnapshotStore";
import { AnalyticsEventBus } from "./AnalyticsEventBus";
import { AnalyticsAudit } from "./AnalyticsAudit";
import { InsightsAggregator } from "./InsightsAggregator";
import { AnalyticsExportService } from "./AnalyticsExportService";
import { DashboardBuilders } from "./DashboardBuilders";
import { DateRangeService } from "./DateRangeService";

export interface DashboardRequest {
  scope: AnalyticsScope;
  filter: AnalyticsFilter;
  actorId?: string;
  /** Precomputed sections from callers that already aggregated domain data. */
  sections?: DashboardSection[];
  /** Precomputed insights consumed from source domains. */
  insights?: AnalyticsInsight[];
  /** Skip cache. */
  fresh?: boolean;
}

/**
 * AnalyticsPlatform — single entry point for all dashboards, KPIs, insights
 * and exports. Never queries tables directly; consumers pass in already
 * computed domain data (from Customer / Product / Finance / etc. Services).
 */
export const AnalyticsPlatform = {
  builders: DashboardBuilders,
  insights: InsightsAggregator,
  dates: DateRangeService,
  events: AnalyticsEventBus,
  audit: AnalyticsAudit,

  async generateDashboard(req: DashboardRequest): Promise<DashboardSnapshot> {
    const { scope, filter, sections = [], insights = [], fresh } = req;
    if (!fresh) {
      const cached = SnapshotStore.get(scope, filter.restaurantId, filter.range.from, filter.range.to);
      if (cached) {
        AnalyticsAudit.record({ scope, action: "dashboard_read", restaurantId: filter.restaurantId, actorId: req.actorId, metadata: { cache: true } });
        return cached;
      }
    }
    const snapshot: DashboardSnapshot = {
      scope,
      restaurantId: filter.restaurantId,
      generatedAt: new Date().toISOString(),
      filter,
      sections,
    };
    SnapshotStore.set(snapshot);
    AnalyticsAudit.record({ scope, action: "dashboard_read", restaurantId: filter.restaurantId, actorId: req.actorId });
    await AnalyticsEventBus.publish({ type: "DashboardGenerated", scope, restaurantId: filter.restaurantId, at: snapshot.generatedAt });
    await AnalyticsEventBus.publish({ type: "SnapshotStored", scope, at: snapshot.generatedAt });
    for (const insight of insights) {
      await AnalyticsEventBus.publish({ type: "InsightPublished", insight });
    }
    return snapshot;
  },

  invalidate(scope?: AnalyticsScope, restaurantId?: string) {
    SnapshotStore.invalidate(scope, restaurantId);
  },

  export(snapshot: DashboardSnapshot, format: ExportFormat, filename?: string): ExportResult {
    const result = AnalyticsExportService.export(snapshot, format, filename);
    AnalyticsAudit.record({ scope: snapshot.scope, action: "export", restaurantId: snapshot.restaurantId, metadata: { format } });
    void AnalyticsEventBus.publish({ type: "ExportGenerated", format, at: new Date().toISOString() });
    return result;
  },
};
