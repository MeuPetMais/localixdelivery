// Observability & Operations — types
// Pure types. Nenhuma regra de negócio.

export type LogLevel = "info" | "warning" | "error" | "critical";

export interface LogEntry {
  id: string;
  at: string;
  level: LogLevel;
  service: string;
  message: string;
  request_id?: string | null;
  tenant_id?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
}

export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export type HealthComponentKind =
  | "database"
  | "edge_function"
  | "api"
  | "event_bus"
  | "worker"
  | "job"
  | "cache"
  | "queue"
  | "service";

export interface HealthComponent {
  key: string;
  name: string;
  kind: HealthComponentKind;
  status: HealthStatus;
  latency_ms?: number | null;
  last_check_at: string;
  message?: string | null;
  metadata?: Record<string, unknown>;
}

export interface HealthSnapshot {
  overall: HealthStatus;
  components: HealthComponent[];
  at: string;
}

export interface MetricPoint {
  name: string;
  value: number;
  at: string;
  tags?: Record<string, string>;
}

export interface MetricsSummary {
  window_seconds: number;
  requests_per_minute: number;
  errors_per_minute: number;
  success_rate: number;
  avg_response_ms: number;
  edge_function_avg_ms: number;
  jobs_executed: number;
  queues_pending: number;
  at: string;
}

export type AuditCategory =
  | "login"
  | "admin"
  | "financial"
  | "settings"
  | "ai"
  | "marketing"
  | "feature_flag"
  | "operations";

export interface AuditEntry {
  id: string;
  at: string;
  category: AuditCategory;
  action: string;
  actor_id?: string | null;
  tenant_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown>;
}

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertKind =
  | "service_down"
  | "edge_function_failure"
  | "high_latency"
  | "processing_failure"
  | "repeated_errors"
  | "stuck_job"
  | "custom";

export interface Alert {
  id: string;
  at: string;
  severity: AlertSeverity;
  kind: AlertKind;
  title: string;
  description?: string;
  component_key?: string;
  acknowledged: boolean;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface Incident {
  id: string;
  opened_at: string;
  closed_at?: string | null;
  severity: AlertSeverity;
  title: string;
  summary?: string;
  related_alert_ids: string[];
  status: "open" | "mitigated" | "closed";
}

export interface DiagnosticsReport {
  at: string;
  modules: Array<{
    key: string;
    status: HealthStatus;
    dependencies: string[];
    last_sync_at?: string | null;
    notes?: string;
  }>;
  event_bus_ok: boolean;
}

export interface OperationsDashboardSnapshot {
  at: string;
  health: HealthSnapshot;
  metrics: MetricsSummary;
  active_services: number;
  degraded_services: number;
  recent_errors: LogEntry[];
  active_alerts: Alert[];
  recent_audits: AuditEntry[];
  recent_incidents: Incident[];
}
