// RC6.4 — Modal de instalação PWA do App do Entregador.
// Um único componente reutilizável para o prompt automático (após login)
// e para o botão fixo em Configurações → Instalar aplicativo.

import { useEffect, useState } from "react";
import { Download, Share, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  markInstallDismissed, useDriverPwaInstall, wasInstallDismissed,
} from "@/lib/pwa-driver";

type Props = {
  /** Abre automaticamente quando `beforeinstallprompt` chegar. */
  auto?: boolean;
  /** Controle externo (para botão fixo). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function PwaInstallModal({ auto = false, open, onOpenChange }: Props) {
  const pwa = useDriverPwaInstall();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open! : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };

  useEffect(() => {
    if (!auto || isControlled) return;
    if (pwa.isStandalone) return;
    if (wasInstallDismissed()) return;
    if (pwa.canPrompt) setInternalOpen(true);
  }, [auto, isControlled, pwa.canPrompt, pwa.isStandalone]);

  if (pwa.isStandalone && !isOpen) return null;

  async function handleInstall() {
    const outcome = await pwa.promptInstall();
    if (outcome === "dismissed") markInstallDismissed();
    setOpen(false);
  }

  function handleDismiss() {
    markInstallDismissed();
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">
            Instalar Localix Entregador
          </DialogTitle>
          <DialogDescription>
            Instale o aplicativo para acessar suas entregas rapidamente
            diretamente da tela inicial.
          </DialogDescription>
        </DialogHeader>

        {pwa.isIOS && !pwa.canPrompt && (
          <div className="rounded-2xl bg-muted/60 p-4 text-sm">
            <p className="font-semibold">No iPhone / iPad (Safari):</p>
            <ol className="mt-2 space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Toque em <strong className="mx-1">Compartilhar</strong>
              </li>
              <li className="flex items-start gap-2">
                <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Escolha <strong className="mx-1">Adicionar à Tela Inicial</strong>
              </li>
            </ol>
          </div>
        )}

        {!pwa.canPrompt && !pwa.isIOS && (
          <div className="flex items-start gap-2 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Seu navegador não suporta instalação do aplicativo. Tente pelo
              Chrome, Edge ou Samsung Internet.
            </span>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {pwa.canPrompt && (
            <Button className="w-full rounded-2xl" onClick={handleInstall}>
              <Download className="mr-2 h-4 w-4" /> Instalar
            </Button>
          )}
          <Button variant="outline" className="w-full rounded-2xl" onClick={handleDismiss}>
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botão fixo para as configurações. Some se já instalado ou sem suporte. */
export function PwaInstallButton() {
  const pwa = useDriverPwaInstall();
  const [open, setOpen] = useState(false);
  if (pwa.isStandalone) return null;
  if (!pwa.isSupported && !pwa.canPrompt) return null;
  return (
    <>
      <Button
        variant="outline"
        className="w-full rounded-2xl"
        onClick={() => setOpen(true)}
      >
        <Download className="mr-2 h-4 w-4" /> Instalar aplicativo
      </Button>
      <PwaInstallModal open={open} onOpenChange={setOpen} />
    </>
  );
}
