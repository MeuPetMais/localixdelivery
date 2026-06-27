import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

const NAV_STATE_KEY = "localix:customer-navigation";
const LEGACY_LAST_SLUG_KEY = "localix:last-restaurant-slug";
const POST_LOGIN_REDIRECT_KEY = "postLoginRedirect";

const RESERVED_TOP = new Set([
  "", "home", "inicio", "beneficios", "favoritos", "meus-pedidos", "cliente", "pedido",
  "pedido-sucesso", "auth", "entrar", "esqueci-senha", "redefinir-senha",
  "admin", "dashboard", "menu", "orders", "settings", "ai", "consultor",
  "customers", "finance", "finance-ai", "inventory", "loyalty", "promotions",
  "reviews", "suppliers", "units", "builders", "r", "api",
]);

export type PendingCart = {
  slug: string;
  items: unknown[];
  updatedAt: string;
} | null;

type NavigationSnapshot = {
  lastRestaurantSlug: string | null;
  currentRestaurantSlug: string | null;
  lastVisitedRoute: string | null;
  pendingCart: PendingCart;
  scrollY: number;
};

type RememberOptions = {
  route?: string;
  pendingCart?: PendingCart;
  scrollY?: number;
};

type CustomerNavigationContextValue = NavigationSnapshot & {
  restaurantPath: string | null;
  setCurrentRestaurantSlug: (slug: string | null) => void;
  rememberRestaurantRoute: (slug: string, options?: RememberOptions) => void;
  setPendingCart: (cart: PendingCart) => void;
  prepareLoginRedirect: (fallbackSlug?: string | null) => string;
  navigateToRestaurant: (slug?: string | null) => void;
  restoreRestaurantScroll: (slug: string) => void;
};

const EMPTY_STATE: NavigationSnapshot = {
  lastRestaurantSlug: null,
  currentRestaurantSlug: null,
  lastVisitedRoute: null,
  pendingCart: null,
  scrollY: 0,
};

const CustomerNavigationContext = createContext<CustomerNavigationContextValue | null>(null);

function isBrowser() {
  return typeof window !== "undefined";
}

function restaurantSlugFromPath(pathname: string): string | null {
  const seg = pathname.split("/")[1] ?? "";
  if (!seg || seg.includes(".") || RESERVED_TOP.has(seg)) return null;
  return seg;
}

function restaurantPathFromSlug(slug: string | null | undefined) {
  return slug ? `/${slug}` : null;
}

function safeRestaurantPath(slug: string | null | undefined) {
  return restaurantPathFromSlug(slug) ?? "/cliente";
}

function readStoredState(): NavigationSnapshot {
  if (!isBrowser()) return EMPTY_STATE;
  try {
    const raw = sessionStorage.getItem(NAV_STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<NavigationSnapshot>) : {};
    const legacySlug = sessionStorage.getItem(LEGACY_LAST_SLUG_KEY) || localStorage.getItem(LEGACY_LAST_SLUG_KEY);
    const postLoginSlug = restaurantSlugFromPath(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) ?? "");
    return {
      lastRestaurantSlug: postLoginSlug ?? parsed.lastRestaurantSlug ?? parsed.currentRestaurantSlug ?? legacySlug ?? null,
      currentRestaurantSlug: postLoginSlug ?? parsed.currentRestaurantSlug ?? legacySlug ?? null,
      lastVisitedRoute: parsed.lastVisitedRoute ?? null,
      pendingCart: parsed.pendingCart ?? null,
      scrollY: Number(parsed.scrollY ?? 0) || 0,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function persistState(next: NavigationSnapshot) {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify(next));
    if (next.lastRestaurantSlug) {
      sessionStorage.setItem(LEGACY_LAST_SLUG_KEY, next.lastRestaurantSlug);
      localStorage.setItem(LEGACY_LAST_SLUG_KEY, next.lastRestaurantSlug);
    }
  } catch {}
}

function currentRoute() {
  if (!isBrowser()) return null;
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function CustomerNavigationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useRouterState({
    select: (state) => ({ pathname: state.location.pathname, href: state.location.href }),
  });
  const [state, setState] = useState<NavigationSnapshot>(() => readStoredState());

  const commit = useCallback((updater: (prev: NavigationSnapshot) => NavigationSnapshot) => {
    setState((prev) => {
      const next = updater(prev);
      persistState(next);
      return next;
    });
  }, []);

  const rememberRestaurantRoute = useCallback((slug: string, options: RememberOptions = {}) => {
    const route = options.route ?? currentRoute() ?? `/${slug}`;
    const explicitScroll = options.scrollY !== undefined;
    commit((prev) => ({
      ...prev,
      currentRestaurantSlug: slug,
      lastRestaurantSlug: slug,
      lastVisitedRoute: route,
      pendingCart: options.pendingCart !== undefined ? options.pendingCart : prev.pendingCart,
      scrollY: (() => {
        const nextScroll = explicitScroll ? Number(options.scrollY) || 0 : (isBrowser() ? window.scrollY : prev.scrollY);
        if (!explicitScroll && prev.currentRestaurantSlug === slug && nextScroll <= 0 && prev.scrollY > 0) return prev.scrollY;
        return nextScroll;
      })(),
    }));
  }, [commit]);

  useEffect(() => {
    const slug = restaurantSlugFromPath(location.pathname);
    if (!slug) return;
    rememberRestaurantRoute(slug, { route: location.href || location.pathname });
  }, [location.href, location.pathname, rememberRestaurantRoute]);

  const setCurrentRestaurantSlug = useCallback((slug: string | null) => {
    commit((prev) => ({
      ...prev,
      currentRestaurantSlug: slug,
      lastRestaurantSlug: slug ?? prev.lastRestaurantSlug,
      lastVisitedRoute: slug ? prev.lastVisitedRoute ?? `/${slug}` : prev.lastVisitedRoute,
    }));
  }, [commit]);

  const setPendingCart = useCallback((cart: PendingCart) => {
    commit((prev) => ({ ...prev, pendingCart: cart }));
  }, [commit]);

  const prepareLoginRedirect = useCallback((fallbackSlug?: string | null) => {
    const slug = fallbackSlug ?? state.currentRestaurantSlug ?? state.lastRestaurantSlug;
    const target = safeRestaurantPath(slug);
    if (slug) rememberRestaurantRoute(slug, { route: target, scrollY: isBrowser() ? window.scrollY : 0 });
    if (isBrowser()) {
      try { sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, target); } catch {}
    }
    return target;
  }, [rememberRestaurantRoute, state.currentRestaurantSlug, state.lastRestaurantSlug]);

  const navigateToRestaurant = useCallback((slug?: string | null) => {
    const targetSlug = slug ?? state.currentRestaurantSlug ?? state.lastRestaurantSlug;
    if (targetSlug) navigate({ to: "/$slug", params: { slug: targetSlug }, replace: true });
  }, [navigate, state.currentRestaurantSlug, state.lastRestaurantSlug]);

  const restoreRestaurantScroll = useCallback((slug: string) => {
    if (!isBrowser()) return;
    const latest = readStoredState();
    const storedSlug = latest.currentRestaurantSlug ?? latest.lastRestaurantSlug;
    if (storedSlug !== slug || latest.scrollY <= 0) return;
    window.requestAnimationFrame(() => window.scrollTo({ top: latest.scrollY, behavior: "auto" }));
  }, []);

  const value = useMemo<CustomerNavigationContextValue>(() => ({
    ...state,
    restaurantPath: restaurantPathFromSlug(state.currentRestaurantSlug ?? state.lastRestaurantSlug),
    setCurrentRestaurantSlug,
    rememberRestaurantRoute,
    setPendingCart,
    prepareLoginRedirect,
    navigateToRestaurant,
    restoreRestaurantScroll,
  }), [
    state,
    setCurrentRestaurantSlug,
    rememberRestaurantRoute,
    setPendingCart,
    prepareLoginRedirect,
    navigateToRestaurant,
    restoreRestaurantScroll,
  ]);

  return <CustomerNavigationContext.Provider value={value}>{children}</CustomerNavigationContext.Provider>;
}

export function useCustomerNavigation() {
  const ctx = useContext(CustomerNavigationContext);
  if (!ctx) throw new Error("useCustomerNavigation must be used inside CustomerNavigationProvider");
  return ctx;
}

export function getStoredRestaurantPath() {
  const snapshot = readStoredState();
  return restaurantPathFromSlug(snapshot.currentRestaurantSlug ?? snapshot.lastRestaurantSlug);
}