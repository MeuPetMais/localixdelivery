// AlertCenter + IncidentCenter — estrutura para acionamentos operacionais.
import type { Alert, AlertKind, AlertSeverity, Incident } from "./types";

const alerts: Alert[] = [];
const incidents: Incident[] = [];
let aSeq = 0;
let iSeq = 0;

type Listener = (a: Alert) => void;
const listeners = new Set<Listener>();

export interface RaiseAlertInput {
  severity: AlertSeverity;
  kind: AlertKind;
  title: string;
  description?: string;
  component_key?: string;
  metadata?: Record<string, unknown>;
}

export const AlertCenter = {
  raise(input: RaiseAlertInput): Alert {
    const a: Alert = {
      id: `alt_${++aSeq}`,
      at: new Date().toISOString(),
      acknowledged: false,
      ...input,
    };
    alerts.push(a);
    for (const l of listeners) { try { l(a); } catch { /* noop */ } }
    return a;
  },
  ack(id: string, by?: string): Alert | null {
    const a = alerts.find((x) => x.id === id);
    if (!a) return null;
    a.acknowledged = true;
    a.acknowledged_by = by ?? null;
    a.acknowledged_at = new Date().toISOString();
    return a;
  },
  list(opts?: { active?: boolean; severity?: AlertSeverity; limit?: number }): Alert[] {
    let out = alerts;
    if (opts?.active) out = out.filter((a) => !a.acknowledged);
    if (opts?.severity) out = out.filter((a) => a.severity === opts.severity);
    out = [...out].reverse();
    if (opts?.limit) out = out.slice(0, opts.limit);
    return out;
  },
  subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
  _reset() { alerts.length = 0; aSeq = 0; listeners.clear(); },
} as const;

export const IncidentCenter = {
  open(input: { severity: AlertSeverity; title: string; summary?: string; related_alert_ids?: string[] }): Incident {
    const i: Incident = {
      id: `inc_${++iSeq}`,
      opened_at: new Date().toISOString(),
      closed_at: null,
      severity: input.severity,
      title: input.title,
      summary: input.summary,
      related_alert_ids: input.related_alert_ids ?? [],
      status: "open",
    };
    incidents.push(i);
    return i;
  },
  mitigate(id: string): Incident | null {
    const i = incidents.find((x) => x.id === id);
    if (i) i.status = "mitigated";
    return i ?? null;
  },
  close(id: string): Incident | null {
    const i = incidents.find((x) => x.id === id);
    if (i) { i.status = "closed"; i.closed_at = new Date().toISOString(); }
    return i ?? null;
  },
  list(opts?: { limit?: number; open?: boolean }): Incident[] {
    let out = incidents;
    if (opts?.open) out = out.filter((i) => i.status !== "closed");
    out = [...out].reverse();
    if (opts?.limit) out = out.slice(0, opts.limit);
    return out;
  },
  _reset() { incidents.length = 0; iSeq = 0; },
} as const;
