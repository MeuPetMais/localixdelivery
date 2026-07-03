import type { PlatformConfigAuditEntry } from "./types";

export interface PlatformConfigAuditRepository {
  insert(entry: PlatformConfigAuditEntry): Promise<void>;
  list(limit?: number): Promise<PlatformConfigAuditEntry[]>;
  listByTarget(key: string, limit?: number): Promise<PlatformConfigAuditEntry[]>;
}

// Repositório imutável em memória — persistência real deve ser plugada
// via tabela dedicada (ver TECHNICAL_DEBT.md).
export class InMemoryPlatformConfigAuditRepository implements PlatformConfigAuditRepository {
  private entries: PlatformConfigAuditEntry[] = [];

  async insert(entry: PlatformConfigAuditEntry): Promise<void> {
    // Frozen -> histórico imutável.
    this.entries.push(Object.freeze({
      ...entry,
      id: entry.id ?? crypto.randomUUID(),
      created_at: entry.created_at ?? new Date().toISOString(),
    }));
  }
  async list(limit = 200): Promise<PlatformConfigAuditEntry[]> {
    return [...this.entries].reverse().slice(0, limit);
  }
  async listByTarget(key: string, limit = 100): Promise<PlatformConfigAuditEntry[]> {
    return this.entries.filter((e) => e.target_key === key).reverse().slice(0, limit);
  }
}

export class PlatformConfigAuditService {
  constructor(private readonly repo: PlatformConfigAuditRepository = new InMemoryPlatformConfigAuditRepository()) {}
  record(entry: PlatformConfigAuditEntry): Promise<void> { return this.repo.insert(entry); }
  list(limit?: number): Promise<PlatformConfigAuditEntry[]> { return this.repo.list(limit); }
  history(key: string, limit?: number): Promise<PlatformConfigAuditEntry[]> { return this.repo.listByTarget(key, limit); }
}
