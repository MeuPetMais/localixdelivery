import type { ProductionEvent, ProductionEventName } from "./types";

type Handler = (e: ProductionEvent) => void;
const handlers = new Map<ProductionEventName, Set<Handler>>();

export const ProductionEventBus = {
  on(name: ProductionEventName, h: Handler) {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name)!.add(h);
    return () => handlers.get(name)!.delete(h);
  },
  emit(e: ProductionEvent) {
    handlers.get(e.name)?.forEach((h) => { try { h(e); } catch { /* ignore */ } });
  },
  clear() { handlers.clear(); },
};
