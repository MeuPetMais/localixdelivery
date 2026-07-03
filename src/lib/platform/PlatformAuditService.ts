import type { PlatformAuditEntry } from "./types";

export interface PlatformAuditRepository {
  insert(entry: PlatformAuditEntry): Promise<void>;
  list(limit?: number): Promise<PlatformAuditEntry[]>;
}

// Repositório in-memory usado por testes e como fallback determinístico.
// Persistência real deve ser plugada via repositório baseado em Supabase quando
// a tabela `platform_audit_log` for provisionada (ver TECHNICAL_DEBT.md).
export class InMemoryPlatformAuditRepository implements PlatformAuditRepository {
  private entries: PlatformAuditEntry[] = [];

  async insert(entry: PlatformAuditEntry): Promise<void> {
    this.entries.push({
      ...entry,
      id: entry.id ?? crypto.randomUUID(),
      created_at: entry.created_at ?? new Date().toISOString(),
    });
  }

  async list(limit = 100): Promise<PlatformAuditEntry[]> {
    return [...this.entries].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    ).slice(0, limit);
  }
}

export class PlatformAuditService {
  constructor(private readonly repo: PlatformAuditRepository = new InMemoryPlatformAuditRepository()) {}

  record(entry: PlatformAuditEntry): Promise<void> {
    return this.repo.insert(entry);
  }

  list(limit?: number): Promise<PlatformAuditEntry[]> {
    return this.repo.list(limit);
  }

  diff<T extends Record<string, unknown>>(before: T, after: T): Record<string, { from: unknown; to: unknown }> {
    const out: Record<string, { from: unknown; to: unknown }> = {};
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    for (const key of keys) {
      if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
        out[key] = { from: before?.[key], to: after?.[key] };
      }
    }
    return out;
  }
}
