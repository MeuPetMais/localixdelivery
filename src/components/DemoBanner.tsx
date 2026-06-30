import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "localix.demo.banner.dismissed_at";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function DemoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return setVisible(true);
      const ts = Number(raw);
      if (!Number.isFinite(ts) || Date.now() - ts > THIRTY_DAYS_MS) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  }

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5">
      <button
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">
              🎯 Você está utilizando a Conta Demo do Localix
            </h3>
            <p className="text-sm text-muted-foreground">
              Todos os dados são fictícios e servem apenas para demonstração da plataforma.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          <Button asChild variant="outline" size="sm">
            <a href="/" target="_blank" rel="noreferrer">Conhecer o sistema</a>
          </Button>
          <Button asChild size="sm">
            <a href="/auth" target="_blank" rel="noreferrer">Criar minha conta gratuita</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
