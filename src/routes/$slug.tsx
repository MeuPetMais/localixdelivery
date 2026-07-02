import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { CreateLocalixCta } from "@/components/CreateLocalixCta";
import { useRestaurantSession } from "@/contexts/RestaurantSessionContext";

const RESERVED_SLUGS = new Set([
  "admin", "ai", "auth", "beneficios", "builders", "cliente", "consultor",
  "customers", "dashboard", "entrar", "esqueci-senha", "favoritos", "featured",
  "finance", "finance-ai", "home", "inventory", "kitchen", "loyalty", "menu",
  "meus-enderecos", "meus-pedidos", "orders", "pedido", "pedido-sucesso",
  "perfil", "promotions", "r", "redefinir-senha", "reviews", "settings",
  "suppliers", "units",
]);

export const Route = createFileRoute("/$slug")({
  ssr: false,
  beforeLoad: ({ params }) => {
    if (RESERVED_SLUGS.has(params.slug) || params.slug.includes(".")) {
      throw notFound();
    }
  },
  notFoundComponent: NotFoundRestaurant,
  component: SlugLayout,
});

function NotFoundRestaurant() {
  // Restaurante removido/renomeado: apenas informa. Nunca redireciona
  // para outro estabelecimento nem lista restaurantes.
  const { markUnavailable } = useRestaurantSession();
  useEffect(() => { markUnavailable(); }, [markUnavailable]);
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div className="space-y-3">
        <p className="text-lg font-semibold">Este estabelecimento não está mais disponível.</p>
      </div>
    </div>
  );
}

function SlugLayout() {
  const { slug } = Route.useParams();
  return (
    <>
      <Outlet />
      {slug === "demo" && <CreateLocalixCta />}
    </>
  );
}

