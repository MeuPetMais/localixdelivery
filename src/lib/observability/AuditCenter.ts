// AuditCenter — canal unificado de auditoria da plataforma.
// Persistência real fica nos audits específicos de cada domínio; este agrega em memória.
import { sanitizeLogPayload } from "@/lib/security";
import type { AuditCategory, AuditEntry } from "./types";

const MAX = 1000;
const buffer: AuditEntry[] = [];
let seq = 0;

export interface AuditInput {
  category: AuditCategory;
  action: string;
  actor_id?: string | null;
  tenant_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown>;
}

export const AuditCenter = {
  record(input: AuditInput): AuditEntry {
    const e: AuditEntry = {
      id: `aud_${++seq}`,
      at: new Date().toISOString(),
      category: input.category,
      action: input.action,
      actor_id: input.actor_id ?? null,
      tenant_id: input.tenant_id ?? null,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      metadata: input.metadata ? (sanitizeLogPayload(input.metadata) as Record<string, unknown>) : undefined,
    };
    buffer.push(e);
    if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
    return e;
  },
  list(filter?: { category?: AuditCategory; tenant_id?: string; limit?: number }): AuditEntry[] {
    let out = buffer;
    if (filter?.category) out = out.filter((e) => e.category === filter.category);
    if (filter?.tenant_id) out = out.filter((e) => e.tenant_id === filter.tenant_id);
    out = [...out].reverse();
    if (filter?.limit) out = out.slice(0, filter.limit);
    return out;
  },
  _reset() { buffer.length = 0; seq = 0; },
} as const;
