import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import {
  filterNavigation,
  NAVIGATION,
  type DashboardRole,
  type WorkspaceId,
  type NavigationItem,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";

interface Props {
  role: DashboardRole;
  workspace?: WorkspaceId;
  collapsed?: boolean;
  onNavigate?: () => void;
}

const STORAGE_KEY = "localix:sidebar:open-group";

export function RestaurantNavigation({ role, workspace, collapsed, onNavigate }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const sections = useMemo(() => {
    const filtered = filterNavigation(NAVIGATION, role);
    return workspace
      ? [...filtered].sort(
          (a, b) => Number(b.workspace === workspace) - Number(a.workspace === workspace),
        )
      : filtered;
  }, [role, workspace]);

  const isActive = useCallback(
    (to?: string) => !!to && (pathname === to || pathname.startsWith(`${to}/`)),
    [pathname],
  );

  const activeGroupId = useMemo(
    () =>
      sections.find((s) => s.children?.some((c) => isActive(c.to)))?.id ?? null,
    [sections, isActive],
  );

  const [openId, setOpenId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  // Auto-open the group matching the active route.
  useEffect(() => {
    if (activeGroupId) setOpenId(activeGroupId);
  }, [activeGroupId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (openId) window.localStorage.setItem(STORAGE_KEY, openId);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [openId]);

  const toggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  return (
    <nav className="flex flex-col gap-1 p-2" aria-label="Navegação principal">
      {sections.map((section) =>
        section.children && section.children.length > 0 ? (
          <AccordionGroup
            key={section.id}
            section={section}
            collapsed={collapsed}
            isOpen={openId === section.id}
            onToggle={() => toggle(section.id)}
            isActive={isActive}
            onNavigate={onNavigate}
          />
        ) : section.to ? (
          <Leaf
            key={section.id}
            item={section}
            collapsed={collapsed}
            active={isActive(section.to)}
            onNavigate={onNavigate}
          />
        ) : null,
      )}
    </nav>
  );
}

function AccordionGroup({
  section,
  collapsed,
  isOpen,
  onToggle,
  isActive,
  onNavigate,
}: {
  section: NavigationItem;
  collapsed?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  isActive: (to?: string) => boolean;
  onNavigate?: () => void;
}) {
  const hasActiveChild = section.children?.some((c) => isActive(c.to)) ?? false;
  const contentId = `nav-group-${section.id}`;

  if (collapsed) {
    return (
      <div className="flex flex-col gap-0.5">
        {section.children!.map((child) => (
          <Leaf
            key={child.id}
            item={child}
            collapsed
            active={isActive(child.to)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" && !isOpen) {
      e.preventDefault();
      onToggle();
    } else if (e.key === "ArrowLeft" && isOpen) {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        onKeyDown={onKeyDown}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={cn(
          "group flex items-center justify-between rounded-lg px-3 py-3 text-xs font-semibold uppercase tracking-wide transition-colors",
          "hover:bg-muted",
          isOpen || hasActiveChild
            ? "bg-muted/60 text-foreground"
            : "text-muted-foreground",
        )}
      >
        <span className="truncate">{section.label}</span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            isOpen && "rotate-90",
            (isOpen || hasActiveChild) && "text-primary",
          )}
        />
      </button>
      <div
        id={contentId}
        role="region"
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          {isOpen && (
            <div className="mt-1 flex flex-col gap-0.5 pl-2 animate-fade-in">
              {section.children!.map((child) => (
                <Leaf
                  key={child.id}
                  item={child}
                  active={isActive(child.to)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Leaf({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavigationItem;
  collapsed?: boolean;
  active?: boolean;
  onNavigate?: () => void;
}) {
  if (!item.to) return null;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-md px-3 py-3 text-sm transition-colors",
        "hover:bg-muted",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-foreground/80",
      )}
    >
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && <span className="truncate text-xs">{item.label.slice(0, 2)}</span>}
    </Link>
  );
}
