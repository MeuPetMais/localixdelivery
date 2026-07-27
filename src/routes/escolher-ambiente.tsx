import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Store, ArrowRight } from "lucide-react";
import {
  clearImpersonation,
  isCurrentUserAdmin,
  setImpersonatedRestaurantId,
  setPreferredEnv,
} from "@/lib/admin-mode";

export const Route = createFileRoute("/escolher-ambiente")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: undefined } as { mode: string | undefined } });
    const admin = await isCurrentUserAdmin(data.user.id);
    if (!admin) throw redirect({ to: "/dashboard" });
    return { user: data.user };
  },
  head: () => ({ meta: [{ title: "Escolha seu ambiente — Localix" }] }),
  component: EnvironmentChooser,
});

type MyRestaurant = { id: string; name: string; slug: string | null };

function EnvironmentChooser() {
  const { user } = Route.useRouteContext() as { user: { id: string } };
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<MyRestaurant[] | null>(null);

  useEffect(() => {
    supabase
      .from("restaurants")
      .select("id, name, slug")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setRestaurants(data ?? []));
  }, [user.id]);

  function goAdmin() {
    clearImpersonation();
    setPreferredEnv("admin");
    navigate({ to: "/admin" });
  }

  function goPartner(id?: string) {
    if (id) setImpersonatedRestaurantId(id);
    else clearImpersonation();
    setPreferredEnv("partner");
    navigate({ to: "/dashboard" });
  }

  const loading = restaurants === null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold">Escolha seu ambiente</h1>
          <p className="mt-2 text-sm text-slate-400">
            Você pode trocar de ambiente a qualquer momento pelo botão “Trocar Ambiente”.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <button
            onClick={goAdmin}
            className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:border-primary/60 hover:bg-slate-900/80"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/20 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <div className="text-lg font-bold">👨‍💼 Painel Administrativo</div>
                <div className="text-xs text-slate-400">Entrar no painel completo da plataforma.</div>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-primary">
              Abrir <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </button>

          <Card className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-amber-500/20 text-amber-300">
                <Store className="h-6 w-6" />
              </span>
              <div>
                <div className="text-lg font-bold">🏪 Painel do Estabelecimento</div>
                <div className="text-xs text-slate-400">
                  Acesse o dashboard do parceiro.
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              )}
              {!loading && restaurants!.length === 0 && (
                <p className="text-sm text-slate-400">
                  Você ainda não possui estabelecimento. Use “Entrar como estabelecimento” no
                  menu de Parceiros para visualizar qualquer restaurante como administrador.
                </p>
              )}
              {!loading && restaurants!.length === 1 && (
                <Button className="w-full" onClick={() => goPartner()}>
                  Abrir {restaurants![0].name}
                </Button>
              )}
              {!loading && restaurants!.length > 1 && restaurants!.map((r) => (
                <Button
                  key={r.id}
                  variant="outline"
                  className="w-full justify-between border-slate-700 bg-slate-950/60 text-slate-100 hover:bg-slate-800"
                  onClick={() => goPartner(r.id)}
                >
                  {r.name}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
