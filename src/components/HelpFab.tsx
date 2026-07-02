import { Link, useRouterState } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";

export function HelpFab() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Não exibir na própria página de suporte nem em /auth
  if (pathname.startsWith("/support") || pathname.startsWith("/auth")) return null;

  return (
    <Link
      to="/support"
      aria-label="Central de Suporte"
      className="fixed bottom-4 right-4 z-40 hidden lg:flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-glow transition hover:brightness-110"
    >
      <LifeBuoy className="h-4 w-4" />
      <span className="text-sm font-medium">Ajuda</span>
    </Link>
  );
}
