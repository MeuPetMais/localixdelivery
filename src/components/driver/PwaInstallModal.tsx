// RC6.4 - Modal de instalacao PWA do App do Entregador.

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Info, Plus, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  markInstallDismissed,
  useDriverPwaInstall,
  wasInstallDismissed,
} from "@/lib/pwa-driver";

type Props = {
  auto?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function PwaInstallModal({ auto = false, open, onOpenChange }: Props) {
  const pwa = useDriverPwaInstall();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open! : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled) onOpenChange?.(value);
    else setInternalOpen(value);
  };

  useEffect(() => {
    if (!auto || isControlled) return;
    if (pwa.availability === "installed") return;
    if (wasInstallDismissed()) return;
    if (pwa.availability === "available") setInternalOpen(true);
  }, [auto, isControlled, pwa.availability]);

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

        {pwa.availability === "installed" && (
          <div className="flex items-start gap-2 rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>O Localix Entregador já está instalado.</span>
          </div>
        )}

        {pwa.isIOS && pwa.availability === "manual" && (
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

        {!pwa.isIOS && pwa.availability === "manual" && (
          <div className="flex items-start gap-2 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Abra o menu ⋮ do Chrome e toque em Adicionar à tela inicial ou
              Instalar aplicativo.
            </span>
          </div>
        )}

        {pwa.availability === "unsupported" && (
          <div className="flex items-start gap-2 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              A instalação não está disponível neste navegador. Tente pelo
              Chrome, Edge ou Samsung Internet.
            </span>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {pwa.availability === "available" && (
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

export function PwaInstallButton() {
  const pwa = useDriverPwaInstall();
  const [open, setOpen] = useState(false);

  if (pwa.availability === "installed") {
    return (
      <div className="flex items-start gap-2 rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-700">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>O Localix Entregador já está instalado.</span>
      </div>
    );
  }

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
