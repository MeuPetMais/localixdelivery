import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Settings,
  LogOut,
  ShieldCheck,
  ClipboardList,
  Users,
  Sparkles,
  Brain,
  Wallet,
  Package,
  LineChart,
  Building2,
  Store,
  Bot,
  Star,
  Menu as MenuIcon,
  X,
  Flame,
  UserCircle,
} from "lucide-react";

import { useIsAdmin } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = Route.useRouteContext() as { user: { id: string } };
  const { isAdmin } = useIsAdmin(user.id);
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = [
    { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
    { to: "/orders", label: "Pedidos", icon: ClipboardList },
    { to: "/menu", label: "Cardápio", icon: UtensilsCrossed },
    { to: "/promotions", label: "Promoções", icon: Flame },
    { to: "/builders", label: "Monte do Seu Jeito", icon: Sparkles },
    { to: "/customers", label: "Clientes", icon: Users },
    { to: "/loyalty", label: "Fidelidade", icon: Sparkles },
    { to: "/reviews", label: "Avaliações", icon: Star },

    { to: "/ai", label: "Central de IA", icon: Brain },
    { to: "/consultor", label: "Consultor IA", icon: Bot },
    { to: "/finance", label: "Financeiro", icon: Wallet },
    { to: "/inventory", label: "Estoque", icon: Package },
    { to: "/finance-ai", label: "Relatórios", icon: LineChart },
    { to: "/units", label: "Multiunidades", icon: Building2 },
    { to: "/suppliers", label: "Central de Negócios", icon: Store },
    { to: "/settings", label: "Perfil do Estabelecimento", icon: Settings },
    { to: "/perfil", label: "Meu Perfil", icon: UserCircle },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ] as const;

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <Link
        to="/dashboard"
        onClick={() => setOpen(false)}
        className="flex h-16 shrink-0 items-center gap-2 border-b px-5 font-display text-lg font-extrabold"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-warm text-primary-foreground shadow-glow">
          L
        </span>
        <span className="truncate">
          Localix <span className="text-primary">AI</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-background lg:block">
        {SidebarInner}
      </aside>

      {/* Mobile sidebar overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-background lg:hidden">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-3 rounded-md p-1.5 hover:bg-accent"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarInner}
          </aside>
        </>
      )}

      <div className="lg:pl-64">
        {/* Mobile top bar with hamburger */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-2 hover:bg-accent"
            aria-label="Abrir menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-extrabold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-warm text-primary-foreground">
              L
            </span>
            Localix
          </Link>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
