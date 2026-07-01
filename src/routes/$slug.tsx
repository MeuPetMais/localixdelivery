import { createFileRoute, notFound, Outlet, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CreateLocalixCta } from "@/components/CreateLocalixCta";
import { clearStoredRestaurantSlug } from "@/contexts/CustomerNavigationContext";

const RESERVED_SLUGS = new Set([
  "admin", "ai", "auth", "beneficios", "builders", "cliente", "consultor",
  "customers", "dashboard", "entrar", "esqueci-senha", "favoritos", "finance",
  "finance-ai", "home", "inventory", "loyalty", "menu", "meus-pedidos",
  "orders", "pedido", "pedido-sucesso", "promotions", "r", "redefinir-senha",
  "reviews", "settings", "suppliers", "units",
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
  // Purga qualquer slug persistido — evita que Início/home/pós-login
  // reabra um restaurante que foi renomeado ou desativado.
  useEffect(() => { clearStoredRestaurantSlug(); }, []);
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div className="space-y-3">
        <p className="text-lg font-semibold">Restaurante não encontrado.</p>
        <p className="text-sm text-muted-foreground">Esse endereço pode ter mudado ou o estabelecimento não está mais ativo.</p>
        <Link to="/home" className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Ver restaurantes
        </Link>
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

