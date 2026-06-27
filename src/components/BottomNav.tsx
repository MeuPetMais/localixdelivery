import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Gift, Heart, Receipt, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCustomerNavigation } from "@/contexts/CustomerNavigationContext";

type Item = {
  key: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
};

const RESERVED_TOP = new Set([
  "", "home", "beneficios", "favoritos", "meus-pedidos", "cliente", "pedido",
  "pedido-sucesso", "auth", "entrar", "esqueci-senha", "redefinir-senha",
  "admin", "dashboard", "menu", "orders", "settings", "ai", "consultor",
  "customers", "finance", "finance-ai", "inventory", "loyalty", "promotions",
  "reviews", "suppliers", "units", "builders", "r",
]);

function isRestaurantPath(p: string) {
  const seg = p.split("/")[1] ?? "";
  return !!seg && !RESERVED_TOP.has(seg) && !seg.includes(".");
}

const items: Item[] = [
  { key: "home", label: "Início", icon: Home, match: (p) => isRestaurantPath(p) },
  { key: "beneficios", label: "Benefícios", icon: Gift, match: (p) => p.startsWith("/beneficios") },
  { key: "favoritos", label: "Favoritos", icon: Heart, match: (p) => p.startsWith("/favoritos") },
  { key: "pedidos", label: "Pedidos", icon: Receipt, match: (p) => p.startsWith("/meus-pedidos") || p.startsWith("/pedido") },
  { key: "perfil", label: "Perfil", icon: User, match: (p) => p.startsWith("/cliente") },
];


export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { lastRestaurantSlug, currentRestaurantSlug, navigateToRestaurant, rememberRestaurantRoute } = useCustomerNavigation();
  const activeSlug = currentRestaurantSlug ?? lastRestaurantSlug;

  function handleClick(e: React.MouseEvent, key: string) {
    if (activeSlug && isRestaurantPath(pathname)) {
      rememberRestaurantRoute(activeSlug, { route: `/${activeSlug}`, scrollY: typeof window !== "undefined" ? window.scrollY : 0 });
    }
    if (key !== "home") return;
    e.preventDefault();
    navigateToRestaurant(activeSlug);
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md rounded-t-2xl shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-[64px] max-w-3xl items-stretch justify-around px-1">
        {items.map(({ key, label, icon: Icon, match }) => {
          const active = match(pathname);
          const to =
            key === "home"
              ? activeSlug
                ? `/${activeSlug}`
                : "/cliente"
              : key === "beneficios"
                ? "/beneficios"
                : key === "favoritos"
                  ? "/favoritos"
                  : key === "pedidos"
                    ? "/meus-pedidos"
                    : "/cliente";
          return (
            <li key={key} className="flex-1">
              <Link
                to={to}
                onClick={(e) => handleClick(e, key)}
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
