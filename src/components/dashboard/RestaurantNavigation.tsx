import { useState, useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { filterNavigation, NAVIGATION, type DashboardRole, type WorkspaceId, type NavigationItem } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

interface Props {
  role: DashboardRole;
  workspace?: WorkspaceId;
  collapsed?: boolean;
}

export function RestaurantNavigation({ role, workspace, collapsed }: Props) {
  // eslint-disable-next-line no-console
  console.log("__NAVIGATION_RENDER__");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const sections = useMemo(() => {
    const filtered = filterNavigation(NAVIGATION, role);
    // Se um workspace específico foi fornecido, priorizar seções desse workspace mas manter todas visíveis.
    return workspace
      ? [...filtered].sort((a, b) => Number(b.workspace === workspace) - Number(a.workspace === workspace))
      : filtered;
  }, [role, workspace]);

  const isActive = (to?: string) => !!to && (pathname === to || pathname.startsWith(`${to}/`));

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {sections.map((section) =>
        section.children && section.children.length > 0 ? (
          <Section
            key={section.id}
            section={section}
            collapsed={collapsed}
            isActive={isActive}
          />
        ) : section.to ? (
          <Leaf key={section.id} item={section} collapsed={collapsed} active={isActive(section.to)} />
        ) : null,
      )}
    </nav>
  );
}

function Section({
  section,
  collapsed,
  isActive,
}: {
  section: NavigationItem;
  collapsed?: boolean;
  isActive: (to?: string) => boolean;
}) {
  const hasActiveChild = section.children?.some((c) => isActive(c.to)) ?? false;
  const [open, setOpen] = useState(hasActiveChild);
  const expanded = open || hasActiveChild;

  if (collapsed) {
    return (
      <div className="flex flex-col gap-0.5">
        {section.children!.map((child) => (
          <Leaf key={child.id} item={child} collapsed active={isActive(child.to)} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide",
          hasActiveChild ? "text-foreground" : "text-muted-foreground",
          "hover:bg-muted",
        )}
        aria-expanded={expanded}
      >
        <span className="truncate">{section.label}</span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-2">
          {section.children!.map((child) => (
            <Leaf key={child.id} item={child} active={isActive(child.to)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Leaf({
  item,
  collapsed,
  active,
}: {
  item: NavigationItem;
  collapsed?: boolean;
  active?: boolean;
}) {
  if (!item.to) return null;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
        active ? "bg-muted font-medium text-foreground" : "text-foreground/80",
      )}
    >
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && <span className="truncate text-xs">{item.label.slice(0, 2)}</span>}
    </Link>
  );
}
