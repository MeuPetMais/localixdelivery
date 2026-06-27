import { createFileRoute, notFound } from "@tanstack/react-router";
import { PublicMenuScreen } from "./r.$slug.index";

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
  loader: ({ params }) => {
    if (RESERVED_SLUGS.has(params.slug) || params.slug.includes(".")) {
      throw notFound();
    }
    return null;
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
  component: ShortRestaurantRoute,
});

function ShortRestaurantRoute() {
  const { slug } = Route.useParams();
  return <PublicMenuScreen slug={slug} />;
}