import type { DashboardSnapshot, AnalyticsScope } from "./types";

const TTL_MS = 60_000;

type Entry = { snapshot: DashboardSnapshot; expiresAt: number };
const store = new Map<string, Entry>();

function keyOf(scope: AnalyticsScope, restaurantId: string | undefined, from: string, to: string) {
  return `${scope}::${restaurantId ?? "_"}::${from}::${to}`;
}

export const SnapshotStore = {
  get(scope: AnalyticsScope, restaurantId: string | undefined, from: string, to: string): DashboardSnapshot | null {
    const e = store.get(keyOf(scope, restaurantId, from, to));
    if (!e) return null;
    if (Date.now() > e.expiresAt) { store.delete(keyOf(scope, restaurantId, from, to)); return null; }
    return e.snapshot;
  },
  set(snapshot: DashboardSnapshot, ttlMs = TTL_MS) {
    const { scope, restaurantId, filter } = snapshot;
    store.set(keyOf(scope, restaurantId, filter.range.from, filter.range.to), {
      snapshot,
      expiresAt: Date.now() + ttlMs,
    });
  },
  invalidate(scope?: AnalyticsScope, restaurantId?: string) {
    if (!scope) { store.clear(); return; }
    for (const key of [...store.keys()]) {
      if (key.startsWith(`${scope}::${restaurantId ?? ""}`)) store.delete(key);
    }
  },
  _size() { return store.size; },
};
