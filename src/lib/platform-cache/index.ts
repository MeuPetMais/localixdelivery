/**
 * Platform Cache — abstração unificada de cache em memória com TTL.
 *
 * Objetivo: consolidar a estratégia de cache dos domínios (Config, KPIs,
 * Dashboards, Analytics, Catálogo, Feature Flags) atrás de uma única
 * interface para permitir substituição futura por Redis/KV sem tocar
 * nos Services.
 *
 * Não altera regras de negócio. Apenas fornece um driver in-memory com
 * TTL + invalidação por chave/prefixo. Drivers remotos podem implementar
 * a mesma interface (`CacheDriver`).
 */

export interface CacheDriver {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlMs?: number): void;
  invalidate(key: string): void;
  invalidatePrefix(prefix: string): void;
  clear(): void;
  size(): number;
}

interface Entry { value: unknown; expires_at: number }

export class MemoryCacheDriver implements CacheDriver {
  private store = new Map<string, Entry>();
  constructor(private defaultTtlMs = 30_000) {}

  get<T>(key: string): T | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expires_at) { this.store.delete(key); return null; }
    return e.value as T;
  }
  set<T>(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, { value, expires_at: Date.now() + (ttlMs ?? this.defaultTtlMs) });
  }
  invalidate(key: string): void { this.store.delete(key); }
  invalidatePrefix(prefix: string): void {
    for (const k of this.store.keys()) if (k.startsWith(prefix)) this.store.delete(k);
  }
  clear(): void { this.store.clear(); }
  size(): number { return this.store.size; }
}

/** Namespaces canônicos — evita colisão entre domínios. */
export const CacheNamespaces = {
  config: "cfg:",
  featureFlags: "ff:",
  kpi: "kpi:",
  dashboard: "dash:",
  analytics: "an:",
  catalog: "cat:",
  menu: "menu:",
} as const;

/** Singleton default; testes devem instanciar seu próprio driver. */
export const platformCache: CacheDriver = new MemoryCacheDriver();
