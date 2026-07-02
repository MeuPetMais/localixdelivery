import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Store, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getProfileCompletion } from "@/lib/profile-completion";

export function ProfileCompletionBanner({ restaurant }: { restaurant: any }) {
  const { pct, completed, total, checks, isComplete } = getProfileCompletion(restaurant);
  const missing = total - completed;

  // Ao completar 100%: mostrar um toast discreto UMA vez e sumir do dashboard.
  useEffect(() => {
    if (!isComplete || typeof window === "undefined") return;
    const key = `localix:profile-complete:${restaurant?.id ?? "anon"}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    toast.success("✅ Perfil concluído com sucesso!", {
      description: "Sua loja está pronta para receber pedidos.",
      duration: 5000,
    });
  }, [isComplete, restaurant?.id]);

  if (isComplete) return null;


  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-transparent p-5 shadow-sm">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-warm text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold sm:text-lg">
                🚀 Deixe seu Localix ainda mais completo
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Complete as informações do seu estabelecimento para transmitir mais confiança aos clientes e
                aumentar suas chances de receber pedidos.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Perfil do estabelecimento</span>
              <span className="font-bold text-primary">{pct}% concluído</span>
            </div>
            <Progress value={pct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {missing === 1
                ? "Falta apenas 1 informação para concluir seu perfil."
                : `Faltam ${missing} informações para concluir seu perfil.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {checks.map((c) => (
              <span
                key={c.key}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                  c.done
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-border bg-background/60 text-muted-foreground"
                }`}
              >
                <span>{c.emoji}</span>
                <span>{c.label}</span>
                {c.done && <CheckCircle2 className="h-3 w-3" />}
              </span>
            ))}
          </div>
        </div>

        <div className="md:pl-2">
          <Link to="/settings">
            <Button size="lg" className="w-full md:w-auto">
              <Store className="mr-2 h-4 w-4" />
              Completar perfil do estabelecimento
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
