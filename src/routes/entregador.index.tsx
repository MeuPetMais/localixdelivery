// RC-UX.3 — Landing page do app Localix Entregador.
// Ponto de entrada; o app nativo virá em RC futuro.
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bike, Download, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/entregador/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Localix Entregador — Bem-vindo" },
      { name: "description", content: "Baixe o aplicativo Localix Entregador e ative sua conta para começar a fazer entregas." },
      { property: "og:title", content: "Localix Entregador" },
      { property: "og:description", content: "Baixe o app e ative sua conta em minutos." },
    ],
  }),
  component: DriverLanding,
});

function DriverLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-16 pb-12 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
          <Bike className="h-8 w-8" />
        </div>
        <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">Localix</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
          Bem-vindo ao Localix Entregador
        </h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          Você foi cadastrado por um restaurante parceiro. Baixe o app ou ative
          sua conta pela web para começar a receber entregas.
        </p>

        <Card className="mt-8 w-full space-y-3 rounded-3xl border-none p-6 shadow-sm">
          <Button size="lg" className="w-full rounded-2xl" asChild>
            <a
              href="https://play.google.com/store/apps/details?id=com.localix.entregador"
              target="_blank" rel="noreferrer"
              aria-label="Baixar Localix Entregador para Android"
            >
              <Download className="mr-2 h-4 w-4" /> Baixar app Android
            </a>
          </Button>
          <Button size="lg" variant="outline" className="w-full rounded-2xl" asChild>
            <Link to="/entregador/ativar" aria-label="Já tenho o aplicativo — abrir">
              <LogIn className="mr-2 h-4 w-4" /> Já tenho o aplicativo
            </Link>
          </Button>
        </Card>

        <p className="mt-8 text-xs text-muted-foreground">
          Problemas para ativar?{" "}
          <Link to="/entregador/esqueci-senha" className="underline underline-offset-4">
            Recuperar acesso
          </Link>
        </p>
      </div>
    </div>
  );
}
