import type { RecipeEvent, RecipeEventName } from "./types";

type Handler = (e: RecipeEvent) => void;
const handlers = new Map<RecipeEventName, Set<Handler>>();

export const RecipeEventBus = {
  on(name: RecipeEventName, h: Handler) {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name)!.add(h);
    return () => handlers.get(name)!.delete(h);
  },
  emit(e: RecipeEvent) {
    handlers.get(e.name)?.forEach((h) => { try { h(e); } catch { /* ignore */ } });
  },
  clear() { handlers.clear(); },
};
