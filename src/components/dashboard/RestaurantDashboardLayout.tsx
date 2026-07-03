import { useState, type ReactNode } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { RestaurantNavigation } from "./RestaurantNavigation";
import { RestaurantWorkspace } from "./RestaurantWorkspace";
import { CommandPalette, type CommandItem } from "./CommandPalette";
import {
  DashboardAudit,
  buildDashboardCssVars,
  type DashboardBranding,
  type DashboardRestaurantStatus,
  type DashboardRole,
  type WorkspaceId,
} from "@/lib/dashboard";

interface Props {
  restaurantName: string;
  role: DashboardRole;
  status?: DashboardRestaurantStatus;
  branding?: DashboardBranding;
  commands?: CommandItem[];
  children: ReactNode;
}

export function RestaurantDashboardLayout({
  restaurantName, role, status, branding, commands = [], children,
}: Props) {
  const [workspace, setWorkspace] = useState<WorkspaceId>("operation");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const style = buildDashboardCssVars(branding) as React.CSSProperties;

  return (
    <div style={style} className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <DashboardHeader restaurantName={restaurantName} status={status} scheduleLabel={status?.scheduleLabel} />
      <RestaurantWorkspace
        role={role}
        active={workspace}
        onChange={(w) => {
          DashboardAudit.record({ type: "WORKSPACE_CHANGE", payload: { to: w } });
          setWorkspace(w);
        }}
      />
      <div className="flex min-h-0 flex-1">
        <aside className={`shrink-0 border-r transition-all ${sidebarOpen ? "w-56" : "w-14"} hidden md:block`}>
          <button
            className="w-full border-b px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? "‹ Recolher" : "›"}
          </button>
          <RestaurantNavigation role={role} workspace={workspace} collapsed={!sidebarOpen} />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto p-4">{children}</main>
      </div>
      <CommandPalette commands={commands} />
    </div>
  );
}
