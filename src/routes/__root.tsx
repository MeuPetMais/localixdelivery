import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { CustomerNavigationProvider } from "@/contexts/CustomerNavigationContext";
import { RestaurantSessionProvider } from "@/contexts/RestaurantSessionContext";
import { CustomerNotificationsProvider } from "@/contexts/CustomerNotificationsContext";
import { NotificationsBell } from "@/components/NotificationsBell";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O link que você abriu não existe ou foi movido.
        </p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Não conseguimos carregar esta página</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente novamente em instantes.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a href="/" className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent">
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Localix Delivery — Pedidos direto pelo WhatsApp" },
      { name: "description", content: "Plataforma de delivery própria para restaurantes, pizzarias e hamburguerias. Receba pedidos via WhatsApp e cardápio digital sem marketplaces." },
      { property: "og:title", content: "Localix Delivery — Pedidos direto pelo WhatsApp" },
      { property: "og:description", content: "Plataforma de delivery própria para restaurantes, pizzarias e hamburguerias. Receba pedidos via WhatsApp e cardápio digital sem marketplaces." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Localix Delivery — Pedidos direto pelo WhatsApp" },
      { name: "twitter:description", content: "Plataforma de delivery própria para restaurantes, pizzarias e hamburguerias. Receba pedidos via WhatsApp e cardápio digital sem marketplaces." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b0a5582d-3d69-47ff-b7d2-7604975196fd/id-preview-49811661--70a38eb3-fee3-4e1f-b87d-610ac1cf7faf.lovable.app-1782334396836.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b0a5582d-3d69-47ff-b7d2-7604975196fd/id-preview-49811661--70a38eb3-fee3-4e1f-b87d-610ac1cf7faf.lovable.app-1782334396836.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => {});
    }
    if ("caches" in window && import.meta.env.DEV) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
    }
  }, []);


  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (import.meta.env.DEV) {
        console.info("[auth-debug] onAuthStateChange(root)", { event, hasSession: !!session, userId: session?.user?.id, expiresAt: session?.expires_at });
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <RestaurantSessionProvider>
        <CustomerNavigationProvider>
          <CustomerNotificationsProvider>
            <Outlet />
            <CustomerBottomNav />
          </CustomerNotificationsProvider>
        </CustomerNavigationProvider>
      </RestaurantSessionProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

const RESERVED_TOP = new Set([
  "", "home", "beneficios", "favoritos", "meus-pedidos", "meus-enderecos",
  "cliente", "pedido", "pedido-sucesso", "auth", "entrar", "esqueci-senha",
  "redefinir-senha", "admin", "dashboard", "menu", "orders", "settings", "ai",
  "consultor", "customers", "finance", "finance-ai", "financial-center",
  "inventory", "loyalty", "promotions", "reviews", "suppliers", "units",
  "builders", "r", "featured", "kitchen", "perfil", "print-settings",
  "support", "escolher-ambiente", "pagamentos", "analytics", "relatorios",
]);

const CUSTOMER_NAV_MATCHERS: Array<(p: string) => boolean> = [
  (p) => p.startsWith("/beneficios"),
  (p) => p.startsWith("/favoritos"),
  (p) => p.startsWith("/meus-pedidos"),
  (p) => p.startsWith("/cliente"),
  (p) => p.startsWith("/pedido"),
  (p) => {
    // /{slug}/* — público do restaurante
    const seg = p.split("/")[1] ?? "";
    return !!seg && !RESERVED_TOP.has(seg) && !seg.includes(".");
  },
];


function CustomerBottomNav() {
  const { pathname, isAdminArea } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      isAdminArea: s.matches.some((m) =>
        m.routeId?.startsWith("/_authenticated") || m.routeId?.startsWith("/admin"),
      ),
    }),
  });
  if (isAdminArea) return null;
  const show = CUSTOMER_NAV_MATCHERS.some((m) => m(pathname));
  if (!show) return null;
  return (
    <>
      <NotificationsBell />
      <BottomNav />
    </>
  );
}


