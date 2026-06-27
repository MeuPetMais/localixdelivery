import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";

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
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      Restaurante não encontrado.
    </div>
  ),
  component: () => <Outlet />,
});
