// HealthCenter — registro e agregação de status de componentes.
import type { HealthComponent, HealthComponentKind, HealthSnapshot, HealthStatus } from "./types";

const registry = new Map<string, HealthComponent>();

function worst(a: HealthStatus, b: HealthStatus): HealthStatus {
  const order: HealthStatus[] = ["healthy", "unknown", "degraded", "down"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

export interface RegisterInput {
  key: string;
  name: string;
  kind: HealthComponentKind;
}

export interface ReportInput {
  key: string;
  status: HealthStatus;
  latency_ms?: number | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
}

export const HealthCenter = {
  register(input: RegisterInput): HealthComponent {
    const existing = registry.get(input.key);
    const comp: HealthComponent = existing ?? {
      key: input.key,
      name: input.name,
      kind: input.kind,
      status: "unknown",
      last_check_at: new Date().toISOString(),
    };
    comp.name = input.name;
    comp.kind = input.kind;
    registry.set(input.key, comp);
    return comp;
  },
  report(input: ReportInput): HealthComponent {
    const existing = registry.get(input.key);
    if (!existing) {
      const created: HealthComponent = {
        key: input.key, name: input.key, kind: "service",
        status: input.status, latency_ms: input.latency_ms ?? null,
        last_check_at: new Date().toISOString(),
        message: input.message ?? null, metadata: input.metadata,
      };
      registry.set(input.key, created);
      return created;
    }
    existing.status = input.status;
    existing.latency_ms = input.latency_ms ?? existing.latency_ms ?? null;
    existing.message = input.message ?? null;
    existing.metadata = input.metadata ?? existing.metadata;
    existing.last_check_at = new Date().toISOString();
    return existing;
  },
  get(key: string): HealthComponent | null { return registry.get(key) ?? null; },
  snapshot(): HealthSnapshot {
    const components = [...registry.values()];
    const overall = components.reduce<HealthStatus>((acc, c) => worst(acc, c.status), "healthy");
    return { overall, components, at: new Date().toISOString() };
  },
  _reset() { registry.clear(); },
} as const;
