import type { FinanceRole, FinanceTab } from "./types";

export interface FinanceWidgetDefinition {
  id: string;
  title: string;
  tab: FinanceTab;
  span?: 1 | 2 | 3 | 4;
  requiredRoles?: FinanceRole[];
  component: React.ComponentType<{ restaurantId: string }>;
}

const registry = new Map<string, FinanceWidgetDefinition>();

export const FinanceWidgetRegistry = {
  register(def: FinanceWidgetDefinition) {
    registry.set(def.id, def);
    return () => registry.delete(def.id);
  },
  get(id: string) { return registry.get(id); },
  listByTab(tab: FinanceTab, role: FinanceRole): FinanceWidgetDefinition[] {
    return Array.from(registry.values()).filter(w =>
      w.tab === tab && (!w.requiredRoles || w.requiredRoles.includes(role))
    );
  },
  clear() { registry.clear(); },
};
