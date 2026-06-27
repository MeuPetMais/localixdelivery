import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const RESERVED_SLUGS = new Set([
  "admin",
  "ai",
  "auth",
  "beneficios",
  "builders",
  "cliente",
  "consultor",
  "customers",
  "dashboard",
  "entrar",
  "favoritos",
  "finance",
  "finance-ai",
  "home",
  "inventory",
  "loyalty",
  "menu",
  "meus-pedidos",
  "orders",
  "promotions",
  "reviews",
  "settings",
  "suppliers",
  "units",
]);

export const Route = createFileRoute("/$slug")({
  ssr: false,
  beforeLoad: async ({ params, location }) => {
    const slugExtraido = params.slug;
    console.log("[LOADER]", { slug: slugExtraido, pathname: location.pathname });
    console.log({ pathname: location.pathname, slugExtraido });

    if (RESERVED_SLUGS.has(slugExtraido) || slugExtraido.includes(".")) {
      console.log("[LOADER RESULT]", null);
      throw notFound();
    }

    const { data: restaurant, error } = await (supabase as any)
      .from("restaurants_public")
      .select("slug")
      .eq("slug", slugExtraido)
      .maybeSingle();

    console.log("[LOADER RESULT]", restaurant);

    if (error) throw error;
    if (!restaurant?.slug) throw notFound();

    const reason = "valid_short_restaurant_slug";
    console.log("[ROUTER] before redirect", { from: location.pathname, reason });
    setTimeout(() => console.log("[ROUTER] after redirect", window.location.pathname), 0);
    throw redirect({ to: "/r/$slug", params: { slug: restaurant.slug }, replace: true });
  },
  errorComponent: ({ error }) => {
    console.error("[LOADER ERROR]", error);
    return <div className="grid min-h-screen place-items-center px-4 text-center">Não conseguimos carregar esta página.</div>;
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      Restaurante não encontrado.
    </div>
  ),
  component: () => null,
});