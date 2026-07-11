// RC6.2 — Landing do Localix Entregador (separada do Restaurante)
// Fluxo:
//  - Sem sessão → "Ativar minha conta" + "Entrar" (secundário) → /entregador/entrar
//  - Com sessão → "Entrar" (primário) → /motoboy
//  - PWA install NÃO é oferecido aqui (fica na Home, após login).
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bike, LogIn, CheckCircle2, Circle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/entregador/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Localix Entregador — Ative sua conta" },
      { name: "description", content: "Ative sua conta de entregador e comece a realizar entregas do restaurante parceiro." },
      { property: "og:title", content: "Localix Entregador" },
      { property: "og:description", content: "Ative sua conta em minutos e comece a entregar." },
    ],
  }),
  component: DriverLanding,
});

function DriverLanding() {
  const nav = useNavigate();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setHasSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const checklist: Array<{ label: string; done: boolean }> = [
    { label: "Cadastro realizado", done: true },
    { label: "Ativar conta", done: !!hasSession },
    { label: "Primeiro acesso", done: !!hasSession },
    { label: "Entrar na fila", done: false },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 pt-12 pb-16 md:pt-16">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
            <Bike className="h-8 w-8" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">Localix</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Bem-vindo ao Localix Entregador
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
            Você foi cadastrado por um restaurante parceiro. Ative sua conta
            para começar a realizar entregas.
          </p>
        </div>

        <Card className="mt-8 w-full rounded-3xl border-none p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Próximos passos
          </p>
          <ul className="mt-4 space-y-3">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-3">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                )}
                <span className={item.done ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-6 w-full space-y-3 rounded-3xl border-none p-6 shadow-sm">
          {hasSession ? (
            <>
              <Button size="lg" className="w-full rounded-2xl" onClick={() => nav({ to: "/motoboy" })}>
                <LogIn className="mr-2 h-4 w-4" />
                Entrar
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Sua conta já está ativa. Bem-vindo de volta!
              </p>
            </>
          ) : (
            <>
              <Button size="lg" className="w-full rounded-2xl" asChild>
                <Link to="/entregador/ativar" aria-label="Ativar minha conta de entregador">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Ativar minha conta
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full rounded-2xl" asChild>
                <Link to="/entregador/entrar" aria-label="Entrar como entregador">
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </Link>
              </Button>
            </>
          )}
        </Card>

        <div className="mt-10 max-w-md rounded-2xl bg-muted/60 p-4 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">
            O aplicativo Android será disponibilizado em breve. Durante o piloto
            a ativação e o acesso são realizados pela versão web.
          </p>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Problemas para ativar?{" "}
          <Link to="/entregador/esqueci-senha" className="underline underline-offset-4">
            Recuperar acesso
          </Link>
        </p>
      </div>
    </div>
  );
}
