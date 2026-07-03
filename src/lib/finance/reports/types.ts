// Reports & Executive Intelligence — shared types.
import type { FinanceFilters } from "../types";
import type { Json } from "@/integrations/supabase/types";

export type ReportType =
  // Financial
  | "cashflow" | "dre" | "profitability" | "receivables" | "payables"
  | "split" | "ledger" | "reconciliation"
  // Operational
  | "orders" | "products" | "customers" | "delivery" | "inventory" | "production" | "purchasing"
  // Managerial
  | "top_products" | "top_categories" | "top_customers" | "peak_hours" | "top_gateway"
  // Executive dashboards
  | "executive_ceo" | "executive_finance" | "executive_operations" | "executive_production" | "executive_purchasing";

export type ExportFormat = "pdf" | "xlsx" | "csv" | "json";

export type ReportStatus = "PENDING" | "GENERATING" | "READY" | "FAILED" | "EXPIRED";

export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "custom";

export interface ReportRow { [k: string]: string | number | null }

export interface ReportDefinition {
  type: ReportType;
  title: string;
  description?: string;
  filters?: Partial<FinanceFilters> & Record<string, unknown>;
}

export interface ReportResult {
  type: ReportType;
  title: string;
  generatedAt: string;
  filters: Record<string, unknown>;
  columns: string[];
  rows: ReportRow[];
  totals?: Record<string, number>;
  meta?: Record<string, unknown>;
}

export interface ReportRecord {
  id: string;
  restaurant_id: string;
  report_type: ReportType;
  title: string;
  filters_json: Json;
  generated_by: string | null;
  generated_at: string | null;
  file_format: ExportFormat;
  status: ReportStatus;
  file_url: string | null;
  error: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledReportRecord {
  id: string;
  restaurant_id: string;
  name: string;
  frequency: ScheduleFrequency;
  report_type: ReportType;
  filters_json: Json;
  export_format: ExportFormat;
  enabled: boolean;
  last_execution: string | null;
  next_execution: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComparativeResult<T = number> {
  current: T;
  previous: T;
  delta: number;
  deltaPct: number;
}
