import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Heart, Receipt, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Item = {
  to: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
};

const items: Item[] = [
  { to: "/", label: "Início", icon: Home, match: (p) => p === "/" || p.startsWith("/r/") },
  { to: "/buscar", label: "Buscar", icon: Search, match: (p) => p.startsWith("/buscar") },
  { to: "/favoritos", label: "Favoritos", icon: Heart, match: (p) => p.startsWith("/favoritos") },
  { to: "/meus-pedidos", label: "Pedidos", icon: Receipt, match: (p) => p.startsWith("/meus-pedidos") || p.startsWith("/pedido") },
  { to: "/cliente", label: "Perfil", icon: User, match: (p) => p.startsWith("/cliente") },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md rounded-t-2xl shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-[64px] max-w-3xl items-stretch justify-around px-1">
        {items.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className="group relative flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium outline-none"
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full transition-all duration-300 ${
                    active ? "bg-primary/10 text-primary scale-110" : "text-muted-foreground group-active:scale-95"
                  }`}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={`transition-colors ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Spacer so page content isn't covered by the fixed nav. */
export function BottomNavSpacer() {
  return <div aria-hidden className="h-[64px]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />;
}
