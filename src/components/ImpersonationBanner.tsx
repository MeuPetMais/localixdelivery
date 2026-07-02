import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { clearImpersonation, getImpersonatedRestaurantId, setPreferredEnv } from "@/lib/admin-mode";

export function ImpersonationBanner() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(!!getImpersonatedRestaurantId());
  }, []);

  if (!active) return null;

  function back() {
    clearImpersonation();
    setPreferredEnv("admin");
    navigate({ to: "/admin" });
  }

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 bg-amber-500/95 px-4 py-2 text-sm text-slate-900 shadow">
      <div className="flex items-center gap-2 font-medium">
        <ShieldCheck className="h-4 w-4" />
        Você está visualizando este estabelecimento como Administrador.
      </div>
      <button
        onClick={back}
        className="rounded-md border border-slate-900/30 bg-white/60 px-2.5 py-1 text-xs font-semibold hover:bg-white"
      >
        Voltar ao Painel Administrativo
      </button>
    </div>
  );
}
