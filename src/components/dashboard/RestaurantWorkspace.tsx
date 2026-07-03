import { filterWorkspaces, WORKSPACES, type DashboardRole, type WorkspaceId } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

interface Props {
  role: DashboardRole;
  active: WorkspaceId;
  onChange: (ws: WorkspaceId) => void;
}

export function RestaurantWorkspace({ role, active, onChange }: Props) {
  const list = filterWorkspaces(WORKSPACES, role);
  return (
    <div className="flex gap-1 overflow-x-auto border-b px-2 py-1">
      {list.map((w) => (
        <button
          key={w.id}
          onClick={() => onChange(w.id)}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-muted",
            active === w.id ? "bg-muted text-foreground" : "text-muted-foreground",
          )}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}
