// LoggingCenter — buffer padronizado in-memory, sanitizando dados sensíveis.
// Impacto mínimo em performance (buffer circular).
import { sanitizeLogPayload, sanitizeLogString } from "@/lib/security";
import type { LogEntry, LogLevel } from "./types";

const MAX = 500;
const buffer: LogEntry[] = [];
let seq = 0;

type Listener = (entry: LogEntry) => void;
const listeners = new Set<Listener>();

export interface LogInput {
  level: LogLevel;
  service: string;
  message: string;
  request_id?: string | null;
  tenant_id?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
}

export const LoggingCenter = {
  log(input: LogInput): LogEntry {
    const entry: LogEntry = {
      id: `log_${++seq}`,
      at: new Date().toISOString(),
      level: input.level,
      service: input.service,
      message: sanitizeLogString(input.message),
      request_id: input.request_id ?? null,
      tenant_id: input.tenant_id ?? null,
      user_id: input.user_id ?? null,
      metadata: input.metadata ? (sanitizeLogPayload(input.metadata) as Record<string, unknown>) : undefined,
    };
    buffer.push(entry);
    if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
    for (const l of listeners) { try { l(entry); } catch { /* noop */ } }
    return entry;
  },
  info(service: string, message: string, metadata?: Record<string, unknown>) {
    return this.log({ level: "info", service, message, metadata });
  },
  warning(service: string, message: string, metadata?: Record<string, unknown>) {
    return this.log({ level: "warning", service, message, metadata });
  },
  error(service: string, message: string, metadata?: Record<string, unknown>) {
    return this.log({ level: "error", service, message, metadata });
  },
  critical(service: string, message: string, metadata?: Record<string, unknown>) {
    return this.log({ level: "critical", service, message, metadata });
  },
  list(filter?: { level?: LogLevel; service?: string; tenant_id?: string; limit?: number }): LogEntry[] {
    let out = buffer;
    if (filter?.level) out = out.filter((e) => e.level === filter.level);
    if (filter?.service) out = out.filter((e) => e.service === filter.service);
    if (filter?.tenant_id) out = out.filter((e) => e.tenant_id === filter.tenant_id);
    out = [...out].reverse();
    if (filter?.limit) out = out.slice(0, filter.limit);
    return out;
  },
  subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
  _reset() { buffer.length = 0; seq = 0; listeners.clear(); },
} as const;
