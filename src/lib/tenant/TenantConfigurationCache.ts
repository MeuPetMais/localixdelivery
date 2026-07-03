import type { TenantConfiguration } from "./types";

interface CacheEntry {
  value: TenantConfiguration;
  expires_at: number;
}

export class TenantConfigurationCache {
  private store = new Map<string, CacheEntry>();
  constructor(private ttlMs = 30_000) {}

  get(restaurantId: string): TenantConfiguration | null {
    const entry = this.store.get(restaurantId);
    if (!entry) return null;
    if (Date.now() > entry.expires_at) {
      this.store.delete(restaurantId);
      return null;
    }
    return entry.value;
  }

  set(restaurantId: string, value: TenantConfiguration) {
    this.store.set(restaurantId, { value, expires_at: Date.now() + this.ttlMs });
  }

  invalidate(restaurantId: string) {
    this.store.delete(restaurantId);
  }

  clear() {
    this.store.clear();
  }

  size() {
    return this.store.size;
  }
}

export const tenantConfigCache = new TenantConfigurationCache();
