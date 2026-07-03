import { describe, it, expect, beforeEach } from "vitest";
import { WidgetRegistry } from "./WidgetRegistry";
import { DashboardService } from "./DashboardService";
import { canAccess, filterNavigation, filterWorkspaces } from "./permissions";
import { WORKSPACES, NAVIGATION } from "./workspaces";
import { DashboardAudit } from "./DashboardAudit";
import { buildDashboardCssVars } from "./theme";
import type { WidgetContext } from "./types";

const ctx: WidgetContext = { restaurantId: "r1", role: "ADMIN", workspace: "operation" };

describe("Dashboard foundation", () => {
  beforeEach(() => {
    WidgetRegistry.clear();
    DashboardAudit.clear();
  });

  it("registers and lists widgets by workspace", () => {
    WidgetRegistry.register({
      id: "w1", title: "W1", workspace: "operation",
      load: async () => ({ n: 1 }), render: () => null,
    });
    WidgetRegistry.register({
      id: "w2", title: "W2", workspace: "financial",
      load: async () => ({ n: 2 }), render: () => null,
    });
    expect(WidgetRegistry.listByWorkspace("operation")).toHaveLength(1);
    expect(WidgetRegistry.get("w2")?.workspace).toBe("financial");
  });

  it("loads a workspace and captures widget errors independently", async () => {
    WidgetRegistry.register({
      id: "ok", title: "OK", workspace: "operation",
      load: async () => ({ v: 42 }), render: () => null,
    });
    WidgetRegistry.register({
      id: "boom", title: "BOOM", workspace: "operation",
      load: async () => { throw new Error("fail"); }, render: () => null,
    });
    const loaded = await DashboardService.loadWorkspace(ctx);
    expect(loaded).toHaveLength(2);
    const boom = loaded.find((l) => l.definition.id === "boom");
    expect(boom?.error).toBe("fail");
  });

  it("filters widgets by role permission", async () => {
    WidgetRegistry.register({
      id: "restricted", title: "R", workspace: "operation",
      requiredRoles: ["ADMIN"],
      load: async () => 1, render: () => null,
    });
    const loaded = await DashboardService.loadWorkspace({ ...ctx, role: "KITCHEN" });
    expect(loaded).toHaveLength(0);
  });

  it("canAccess honors required roles", () => {
    expect(canAccess("ADMIN")).toBe(true);
    expect(canAccess("KITCHEN", ["ADMIN"])).toBe(false);
    expect(canAccess("MANAGER", ["ADMIN", "MANAGER"])).toBe(true);
  });

  it("filters navigation and workspaces by role", () => {
    const kitchenNav = filterNavigation(NAVIGATION, "KITCHEN");
    expect(kitchenNav.find((i) => i.id === "settings")).toBeUndefined();
    const ws = filterWorkspaces(WORKSPACES, "KITCHEN");
    expect(ws.find((w) => w.id === "settings")).toBeUndefined();
  });

  it("audits events and notifies subscribers", () => {
    const seen: string[] = [];
    const off = DashboardAudit.subscribe((e) => seen.push(e.type));
    DashboardAudit.record({ type: "LOGIN" });
    DashboardAudit.record({ type: "WORKSPACE_CHANGE", payload: { to: "financial" } });
    off();
    DashboardAudit.record({ type: "SEARCH" });
    expect(seen).toEqual(["LOGIN", "WORKSPACE_CHANGE"]);
    expect(DashboardAudit.recent()).toHaveLength(3);
  });

  it("builds branding css vars", () => {
    const v = buildDashboardCssVars({ primaryColor: "#f00" });
    expect(v["--dashboard-primary"]).toBe("#f00");
  });
});
