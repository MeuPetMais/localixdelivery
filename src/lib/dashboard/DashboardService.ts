import { WidgetRegistry } from "./WidgetRegistry";
import type { WidgetContext, WidgetDefinition } from "./types";
import { canAccess } from "./permissions";

export interface LoadedWidget {
  definition: WidgetDefinition;
  data?: unknown;
  error?: string;
}

/**
 * DashboardService centralizes widget loading. Components must NEVER query
 * the database directly — they consume this facade which delegates to the
 * appropriate domain Services (Tenant, Notification, Delivery, Orders, etc.).
 */
export const DashboardService = {
  async loadWorkspace(ctx: WidgetContext): Promise<LoadedWidget[]> {
    const widgets = WidgetRegistry.listByWorkspace(ctx.workspace).filter((w) =>
      canAccess(ctx.role, w.requiredRoles),
    );

    return Promise.all(
      widgets.map(async (definition) => {
        try {
          const data = await definition.load(ctx);
          return { definition, data };
        } catch (err) {
          return {
            definition,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
  },

  async loadWidget(id: string, ctx: WidgetContext): Promise<LoadedWidget | null> {
    const definition = WidgetRegistry.get(id);
    if (!definition) return null;
    if (!canAccess(ctx.role, definition.requiredRoles)) return null;
    try {
      const data = await definition.load(ctx);
      return { definition, data };
    } catch (err) {
      return {
        definition,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
