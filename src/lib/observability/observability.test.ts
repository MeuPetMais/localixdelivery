import { describe, it, expect, beforeEach } from "vitest";
import {
  LoggingCenter, MetricsCenter, AuditCenter, HealthCenter,
  AlertCenter, IncidentCenter, DiagnosticsCenter, OperationsDashboard,
} from "./index";

beforeEach(() => {
  LoggingCenter._reset();
  MetricsCenter._reset();
  AuditCenter._reset();
  HealthCenter._reset();
  AlertCenter._reset();
  IncidentCenter._reset();
  DiagnosticsCenter._reset();
});

describe("LoggingCenter", () => {
  it("sanitiza email e bearer no message/metadata", () => {
    const e = LoggingCenter.error("svc", "falha para user@example.com Bearer abc.def.ghi", {
      token: "Bearer abc.def.ghi",
      note: "ok",
    });
    expect(e.message).not.toContain("user@example.com");
    expect(e.message).toContain("[redacted]");
    expect(JSON.stringify(e.metadata)).not.toContain("abc.def.ghi");
  });
  it("filtra por nível", () => {
    LoggingCenter.info("a", "x"); LoggingCenter.error("a", "y");
    expect(LoggingCenter.list({ level: "error" })).toHaveLength(1);
  });
});

describe("MetricsCenter", () => {
  it("calcula summary básico", () => {
    MetricsCenter.incr("request"); MetricsCenter.incr("request"); MetricsCenter.incr("error");
    MetricsCenter.timing("response_ms", 100); MetricsCenter.timing("response_ms", 200);
    const s = MetricsCenter.summary();
    expect(s.requests_per_minute).toBe(2);
    expect(s.errors_per_minute).toBe(1);
    expect(s.avg_response_ms).toBe(150);
    expect(s.success_rate).toBeCloseTo(2 / 3);
  });
});

describe("HealthCenter", () => {
  it("agrega para status pior", () => {
    HealthCenter.register({ key: "db", name: "DB", kind: "database" });
    HealthCenter.register({ key: "bus", name: "Bus", kind: "event_bus" });
    HealthCenter.report({ key: "db", status: "healthy" });
    HealthCenter.report({ key: "bus", status: "degraded" });
    expect(HealthCenter.snapshot().overall).toBe("degraded");
  });
});

describe("AuditCenter", () => {
  it("registra e filtra por categoria", () => {
    AuditCenter.record({ category: "login", action: "sign_in" });
    AuditCenter.record({ category: "admin", action: "role_grant" });
    expect(AuditCenter.list({ category: "login" })).toHaveLength(1);
  });
});

describe("AlertCenter + IncidentCenter", () => {
  it("aciona alerta, faz ack e vincula incidente", () => {
    const a = AlertCenter.raise({ severity: "critical", kind: "service_down", title: "API down" });
    const inc = IncidentCenter.open({ severity: "critical", title: "API down", related_alert_ids: [a.id] });
    AlertCenter.ack(a.id, "ops");
    IncidentCenter.mitigate(inc.id);
    expect(AlertCenter.list({ active: true })).toHaveLength(0);
    expect(IncidentCenter.list()[0].status).toBe("mitigated");
  });
});

describe("DiagnosticsCenter", () => {
  it("reporta módulos com status do HealthCenter", () => {
    HealthCenter.register({ key: "orders", name: "Orders", kind: "service" });
    HealthCenter.report({ key: "orders", status: "healthy" });
    DiagnosticsCenter.registerModule({ key: "orders", dependencies: ["db"] });
    const r = DiagnosticsCenter.report();
    expect(r.modules[0].status).toBe("healthy");
  });
});

describe("OperationsDashboard", () => {
  it("gera snapshot consolidado", () => {
    HealthCenter.register({ key: "db", name: "DB", kind: "database" });
    HealthCenter.report({ key: "db", status: "healthy" });
    MetricsCenter.incr("request");
    LoggingCenter.error("svc", "boom");
    AlertCenter.raise({ severity: "warning", kind: "high_latency", title: "slow" });
    AuditCenter.record({ category: "admin", action: "login" });
    const s = OperationsDashboard.snapshot();
    expect(s.active_services).toBe(1);
    expect(s.recent_errors).toHaveLength(1);
    expect(s.active_alerts).toHaveLength(1);
    expect(s.recent_audits).toHaveLength(1);
  });
});
