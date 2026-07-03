// DiagnosticsCenter — visão consolidada de módulos e dependências.
import { HealthCenter } from "./HealthCenter";
import type { DiagnosticsReport, HealthStatus } from "./types";

interface ModuleSpec {
  key: string;
  dependencies: string[];
  last_sync_at?: string | null;
  notes?: string;
}

const modules = new Map<string, ModuleSpec>();

export const DiagnosticsCenter = {
  registerModule(spec: ModuleSpec) { modules.set(spec.key, spec); },
  markSync(key: string, at: string = new Date().toISOString()) {
    const m = modules.get(key);
    if (m) m.last_sync_at = at;
  },
  report(): DiagnosticsReport {
    const snap = HealthCenter.snapshot();
    const statusOf = (key: string): HealthStatus =>
      snap.components.find((c) => c.key === key)?.status ?? "unknown";
    return {
      at: new Date().toISOString(),
      modules: [...modules.values()].map((m) => ({
        key: m.key,
        status: statusOf(m.key),
        dependencies: m.dependencies,
        last_sync_at: m.last_sync_at ?? null,
        notes: m.notes,
      })),
      event_bus_ok: statusOf("event_bus") !== "down",
    };
  },
  _reset() { modules.clear(); },
} as const;
