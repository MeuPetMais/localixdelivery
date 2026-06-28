import { Link, useRouterState } from "@tanstack/react-router";
import type { MouseEvent } from "react";
import { Home, Gift, Heart, Receipt, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCustomerNavigation } from "@/contexts/CustomerNavigationContext";

type ItemKey = "home" | "beneficios" | "favoritos" | "pedidos" | "perfil";

type Item = {
  key: ItemKey;
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
  const { lastRestaurantSlug, currentRestaurantSlug, rememberRestaurantRoute } = useCustomerNavigation();
  const activeSlug = currentRestaurantSlug ?? lastRestaurantSlug;

  function handleClick(_e: MouseEvent, key: ItemKey, targetPath: string) {
    // Lembra a posição do restaurante antes de sair dele (não interfere na navegação).
    if (activeSlug && isRestaurantPath(pathname) && key !== "home") {
      rememberRestaurantRoute(activeSlug, {
        route: `/${activeSlug}`,
        scrollY: typeof window !== "undefined" ? window.scrollY : 0,
      });
    }
    // Se já estamos exatamente na rota, só rola pro topo — dá feedback visual em vez de "nada acontecer".
    if (typeof window !== "undefined" && window.location.pathname === targetPath) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
          const isHome = key === "home";
          const homeTarget = activeSlug ? `/${activeSlug}` : "/cliente";
          const linkProps =
            isHome && activeSlug
              ? ({ to: "/$slug", params: { slug: activeSlug } } as const)
              : isHome
                ? ({ to: "/cliente" } as const)
                : key === "beneficios"
                  ? ({ to: "/beneficios" } as const)
                  : key === "favoritos"
                    ? ({ to: "/favoritos" } as const)
                    : key === "pedidos"
                      ? ({ to: "/meus-pedidos" } as const)
                      : ({ to: "/cliente" } as const);
          const targetPath = isHome ? homeTarget : (linkProps as { to: string }).to;
          return (
            <li key={key} className="flex-1">
              <Link
                {...(linkProps as any)}
                onClick={(e) => handleClick(e, key, targetPath)}
                className="group relative flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium outline-none touch-manipulation"
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
