// RC6.0 — Landing do Localix Entregador (Fase Piloto)
// Durante o piloto, o download do app Android está oculto.
// O fluxo oficial é a ativação pela versão web.
// A estrutura de download/abrir app foi preservada em código
// (ver `PILOT_HIDE_APP_DOWNLOAD`) para reativação futura.
import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { Bike, LogIn, CheckCircle2, Circle, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { APP_DOWNLOAD_URL, APP_OPEN_URL, IS_PLAY_STORE } from "@/lib/driver-app-config";

/** RC6.0 — Piloto: ocultar botões de download/abrir app. */
const PILOT_HIDE_APP_DOWNLOAD = true;

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

const CHECKLIST: Array<{ label: string; done: boolean }> = [
  { label: "Cadastro realizado", done: true },
  { label: "Ativar conta", done: false },
  { label: "Primeiro acesso", done: false },
  { label: "Entrar na fila", done: false },
];

function DriverLanding() {
  const activationUrl =
    typeof window !== "undefined" ? window.location.origin + "/entregador/ativar" : "https://app.rngdigital.com.br/entregador/ativar";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 pt-12 pb-16 md:pt-16">
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
            Você foi cadastrado por um restaurante parceiro. Agora basta ativar
            sua conta para começar a realizar entregas.
          </p>
        </div>

        {/* Checklist */}
        <Card className="mt-8 w-full rounded-3xl border-none p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Próximos passos
          </p>
          <ul className="mt-4 space-y-3">
            {CHECKLIST.map((item) => (
              <li key={item.label} className="flex items-center gap-3">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                )}
                <span
                  className={
                    item.done
                      ? "text-sm font-medium text-foreground"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Ação principal */}
        <Card className="mt-6 w-full space-y-3 rounded-3xl border-none p-6 shadow-sm">
          <Button size="lg" className="w-full rounded-2xl" asChild>
            <Link to="/entregador/ativar" aria-label="Ativar minha conta de entregador">
              <LogIn className="mr-2 h-4 w-4" />
              Ativar minha conta
            </Link>
          </Button>

          {/* RC6.0 — Botões de download/abrir app ocultos durante o piloto.
              Estrutura preservada para reativação futura (Play Store / APK). */}
          {!PILOT_HIDE_APP_DOWNLOAD && (
            <>
              <Button size="lg" variant="secondary" className="w-full rounded-2xl" asChild>
                <a href={APP_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  {IS_PLAY_STORE ? "Baixar na Play Store" : "Baixar App Android"}
                </a>
              </Button>
              <Button size="lg" variant="outline" className="w-full rounded-2xl" asChild>
                <a href={APP_OPEN_URL}>
                  <Smartphone className="mr-2 h-4 w-4" />
                  Abrir aplicativo
                </a>
              </Button>
            </>
          )}
        </Card>

        {/* QR Code para compartilhar o link de ativação */}
        <div className="mt-8 flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Compartilhar ativação
          </p>
          <div className="mt-3 rounded-2xl bg-card p-3 shadow-inner ring-1 ring-border">
            <QRCodeSVG value={activationUrl} size={144} level="M" includeMargin={false} />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Aponte a câmera do celular para abrir a ativação
          </p>
        </div>

        {/* Rodapé — aviso do piloto */}
        <div className="mt-10 max-w-md rounded-2xl bg-muted/60 p-4 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">
            O aplicativo Android será disponibilizado em breve. Durante o piloto
            a ativação será realizada pela versão web.
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
