import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-role";
import { Loader2, LayoutDashboard, Wallet, Store, Users, Receipt, LogOut, ShieldCheck, Settings, ShoppingBag, Percent, UserCheck, FileBarChart, ScrollText, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext() as { user: { id: string; email?: string } };
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, isLoading } = useIsAdmin(user.id);

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isLoading, isAdmin, navigate]);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  const nav: Array<{ to: string; label: string; icon: any; exact?: boolean }> = [
    { to: "/admin", label: "Dashboard Geral", icon: LayoutDashboard, exact: true },
    { to: "/admin/financeiro", label: "Financeiro da Plataforma", icon: Wallet },
    { to: "/admin/parceiros", label: "Gestão de Parceiros", icon: Store },
    { to: "/admin/clientes", label: "Gestão de Clientes", icon: Users },
    { to: "/admin/transacoes", label: "Gestão Financeira", icon: Receipt },
    { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800 bg-slate-900 lg:block">
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5 font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></span>
          <span>Localix <span className="text-primary">Admin</span></span>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : (pathname === to || pathname.startsWith(`${to}/`));
            return (
              <Link key={to} to={to} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-primary/20 text-primary" : "text-slate-300 hover:bg-slate-800"}`}>
                <Icon className="h-4 w-4" />{label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-slate-800 p-3">
          <div className="mb-2 truncate px-2 text-xs text-slate-400">{user.email}</div>
          <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start text-slate-200 hover:bg-slate-800 hover:text-white">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/80 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center gap-2 overflow-x-auto px-3">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link key={to} to={to} className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${active ? "bg-primary text-primary-foreground" : "text-slate-300"}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </Link>
              );
            })}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
