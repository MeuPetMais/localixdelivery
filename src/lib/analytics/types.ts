export type AnalyticsScope =
  | "platform" | "restaurant" | "operations" | "financial"
  | "marketing" | "executive" | "customer" | "product"
  | "delivery" | "inventory";

export type ComparisonPreset =
  | "today_vs_yesterday" | "week_vs_week" | "month_vs_month"
  | "year_vs_year" | "custom";

export interface DateRange { from: string; to: string }

export interface AnalyticsFilter {
  restaurantId?: string;
  range: DateRange;
  compare?: { preset: ComparisonPreset; against?: DateRange };
}

export type KpiFormat = "currency" | "number" | "percent" | "duration" | "text";
export type KpiTrend = "up" | "down" | "flat";

export interface KpiValue {
  key: string;
  label: string;
  value: number;
  format: KpiFormat;
  previous?: number;
  delta?: number;
  deltaPct?: number;
  trend?: KpiTrend;
  scope: AnalyticsScope;
}

export interface DashboardSection {
  id: string;
  title: string;
  kpis: KpiValue[];
  metadata?: Record<string, unknown>;
}

export interface DashboardSnapshot {
  scope: AnalyticsScope;
  restaurantId?: string;
  generatedAt: string;
  filter: AnalyticsFilter;
  sections: DashboardSection[];
}

export type InsightSeverity = "info" | "warning" | "critical" | "success";
export type InsightSource =
  | "customer" | "product" | "finance" | "delivery"
  | "inventory" | "orders" | "platform";

export interface AnalyticsInsight {
  id: string;
  source: InsightSource;
  severity: InsightSeverity;
  title: string;
  description?: string;
  scope: AnalyticsScope;
  restaurantId?: string;
  metadata?: Record<string, unknown>;
  generatedAt: string;
}

export type ExportFormat = "pdf" | "xlsx" | "csv";

export interface ExportRequest {
  snapshot: DashboardSnapshot;
  format: ExportFormat;
  filename?: string;
}

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  mimeType: string;
  content: string; // base64 or plain text (csv)
  bytes: number;
}

export type AnalyticsEvent =
  | { type: "DashboardGenerated"; scope: AnalyticsScope; at: string; restaurantId?: string }
  | { type: "KpiComputed"; key: string; scope: AnalyticsScope; at: string }
  | { type: "InsightPublished"; insight: AnalyticsInsight }
  | { type: "SnapshotStored"; scope: AnalyticsScope; at: string }
  | { type: "ExportGenerated"; format: ExportFormat; at: string };
