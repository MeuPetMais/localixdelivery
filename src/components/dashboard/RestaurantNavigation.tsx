import { Link } from "@tanstack/react-router";
import { filterNavigation, NAVIGATION, type DashboardRole, type WorkspaceId } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

interface Props {
  role: DashboardRole;
  workspace?: WorkspaceId;
  collapsed?: boolean;
}

export function RestaurantNavigation({ role, workspace, collapsed }: Props) {
  const items = filterNavigation(NAVIGATION, role).filter(
    (i) => !workspace || !i.workspace || i.workspace === workspace,
  );
  return (
    <nav className="flex flex-col gap-1 p-2">
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.to ?? "/dashboard"}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
            "text-foreground/80",
          )}
          activeProps={{ className: "bg-muted font-medium text-foreground" }}
        >
          {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
      ))}
    </nav>
  );
}
