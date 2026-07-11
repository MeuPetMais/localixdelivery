// RC-UX.3.1 — Landing page independente do Localix Entregador.
// Sem layout do app Cliente (bottom nav e headers do cliente ficam ocultos
// pois "entregador" está em RESERVED_TOP no __root.tsx).
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { Bike, Download, LogIn, Smartphone, KeyRound, UserCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { APP_DOWNLOAD_URL, APP_OPEN_URL, IS_PLAY_STORE } from "@/lib/driver-app-config";

export const Route = createFileRoute("/entregador/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Localix Entregador — Ative sua conta" },
      { name: "description", content: "Instale o aplicativo Localix Entregador, ative sua conta e comece a receber entregas do restaurante parceiro." },
      { property: "og:title", content: "Localix Entregador" },
      { property: "og:description", content: "Baixe o app e ative sua conta em minutos." },
    ],
  }),
  component: DriverLanding,
});

const STEPS = [
  { n: 1, icon: Download, title: "Instale o aplicativo", desc: "Baixe o Localix Entregador no seu celular." },
  { n: 2, icon: Smartphone, title: "Abra o aplicativo", desc: "Toque para abrir depois de instalar." },
  { n: 3, icon: UserCheck, title: "Informe CPF e telefone", desc: "Os mesmos dados que o restaurante cadastrou." },
  { n: 4, icon: KeyRound, title: "Crie sua senha", desc: "Escolha uma senha segura de acesso." },
];

function DriverLanding() {
  const [triedOpen, setTriedOpen] = useState(false);

  const handleOpenApp = () => {
    setTriedOpen(true);
    const start = Date.now();
    window.location.href = APP_OPEN_URL;
    // Se o app não abrir em 1.5s, é porque não está instalado.
    window.setTimeout(() => {
      if (Date.now() - start < 2500 && document.visibilityState === "visible") {
        toast.info("App não encontrado", {
          description: "Instale o Localix Entregador primeiro para poder abrir.",
        });
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-12 pb-16 md:pt-16">
        {/* Cabeçalho */}
        <div className="flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
            <Bike className="h-8 w-8" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">Localix</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Bem-vindo ao Localix Entregador
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
            Você foi cadastrado por um restaurante parceiro. Siga os passos abaixo para ativar sua conta.
          </p>
        </div>

        {/* Grid principal: passos + QR */}
        <div className="mt-10 grid w-full gap-6 md:grid-cols-[1fr_auto]">
          {/* Passos */}
          <Card className="rounded-3xl border-none p-6 shadow-sm md:p-8">
            <ol className="space-y-5">
              {STEPS.map((s) => (
                <li key={s.n} className="flex items-start gap-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Passo {s.n}
                    </p>
                    <p className="font-display text-base font-semibold text-foreground">{s.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>
                  </div>
                </li>
              ))}
              <li className="flex items-center gap-3 rounded-2xl bg-success/10 p-3 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Pronto! Você já pode receber entregas.</span>
              </li>
            </ol>
          </Card>

          {/* QR Code lateral (desktop/tablet) */}
          <Card className="hidden rounded-3xl border-none p-6 shadow-sm md:flex md:w-64 md:flex-col md:items-center md:justify-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Escaneie pelo celular
            </p>
            <div className="mt-4 rounded-2xl bg-card p-3 shadow-inner ring-1 ring-border">
              <QRCodeSVG
                value={typeof window !== "undefined" ? window.location.href : "https://app.rngdigital.com.br/entregador"}
                size={160}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Abra a câmera e aponte para o QR Code
            </p>
          </Card>
        </div>

        {/* Ações principais */}
        <Card className="mt-6 w-full space-y-3 rounded-3xl border-none p-6 shadow-sm">
          <Button size="lg" className="w-full rounded-2xl" asChild>
            <a
              href={APP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={IS_PLAY_STORE ? "Baixar Localix Entregador na Play Store" : "Baixar APK Localix Entregador"}
            >
              <Download className="mr-2 h-4 w-4" />
              {IS_PLAY_STORE ? "Baixar na Play Store" : "Baixar App Android"}
            </a>
          </Button>

          <Button
            size="lg"
            variant="secondary"
            className="w-full rounded-2xl"
            onClick={handleOpenApp}
            aria-label="Abrir aplicativo Localix Entregador"
          >
            <Smartphone className="mr-2 h-4 w-4" />
            Abrir aplicativo
          </Button>

          <Button size="lg" variant="outline" className="w-full rounded-2xl" asChild>
            <Link to="/entregador/ativar" aria-label="Ativar conta pela web">
              <LogIn className="mr-2 h-4 w-4" />
              Ativar pela web
            </Link>
          </Button>

          {triedOpen && (
            <p className="text-center text-xs text-muted-foreground">
              Se nada aconteceu, o app ainda não está instalado neste aparelho.
            </p>
          )}
        </Card>

        {/* QR mobile (fallback) */}
        <div className="mt-6 flex flex-col items-center md:hidden">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Compartilhar link via QR
          </p>
          <div className="mt-3 rounded-2xl bg-card p-3 shadow-inner ring-1 ring-border">
            <QRCodeSVG
              value={typeof window !== "undefined" ? window.location.href : "https://app.rngdigital.com.br/entregador"}
              size={140}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Problemas para ativar?{" "}
          <Link to="/entregador/esqueci-senha" className="underline underline-offset-4">
            Recuperar acesso
          </Link>
        </p>
      </div>
    </div>
  );
}
