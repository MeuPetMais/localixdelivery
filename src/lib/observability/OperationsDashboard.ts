// OperationsDashboard — snapshot consolidado para o painel operacional.
import { HealthCenter } from "./HealthCenter";
import { MetricsCenter } from "./MetricsCenter";
import { LoggingCenter } from "./LoggingCenter";
import { AlertCenter, IncidentCenter } from "./AlertCenter";
import { AuditCenter } from "./AuditCenter";
import type { OperationsDashboardSnapshot } from "./types";

export const OperationsDashboard = {
  snapshot(opts?: { tenant_id?: string }): OperationsDashboardSnapshot {
    const health = HealthCenter.snapshot();
    const active = health.components.filter((c) => c.status === "healthy").length;
    const degraded = health.components.filter((c) => c.status === "degraded" || c.status === "down").length;
    return {
      at: new Date().toISOString(),
      health,
      metrics: MetricsCenter.summary(),
      active_services: active,
      degraded_services: degraded,
      recent_errors: LoggingCenter.list({ level: "error", limit: 10, tenant_id: opts?.tenant_id }),
      active_alerts: AlertCenter.list({ active: true, limit: 20 }),
      recent_audits: AuditCenter.list({ tenant_id: opts?.tenant_id, limit: 20 }),
      recent_incidents: IncidentCenter.list({ limit: 10 }),
    };
  },
} as const;
