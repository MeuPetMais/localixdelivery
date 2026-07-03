import type { WidgetDefinition } from "./types";

class WidgetRegistryImpl {
  private widgets = new Map<string, WidgetDefinition>();

  register<T>(widget: WidgetDefinition<T>): void {
    this.widgets.set(widget.id, widget as WidgetDefinition);
  }

  unregister(id: string): void {
    this.widgets.delete(id);
  }

  get(id: string): WidgetDefinition | undefined {
    return this.widgets.get(id);
  }

  list(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }

  listByWorkspace(workspace: string): WidgetDefinition[] {
    return this.list().filter((w) => w.workspace === workspace);
  }

  clear(): void {
    this.widgets.clear();
  }
}

export const WidgetRegistry = new WidgetRegistryImpl();
