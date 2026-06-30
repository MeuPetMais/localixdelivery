import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft, ArrowRight, Check } from "lucide-react";

const STORAGE_KEY = "localix.demo.tour.completed";

type Step = { to: string; title: string; description: string };

const STEPS: Step[] = [
  { to: "/dashboard", title: "Painel", description: "Visão geral do seu negócio: vendas, pedidos e indicadores em tempo real." },
  { to: "/orders", title: "Pedidos", description: "Acompanhe e gerencie todos os pedidos por status em um Kanban prático." },
  { to: "/menu", title: "Cardápio", description: "Cadastre categorias e produtos com fotos, preços e disponibilidade." },
  { to: "/promotions", title: "Promoções", description: "Crie ofertas inteligentes com recorrência, KPIs e ações rápidas." },
  { to: "/builders", title: "Monte do Seu Jeito", description: "Permita que clientes montem pizzas, combos e produtos personalizados." },
  { to: "/customers", title: "Clientes", description: "CRM completo com histórico, segmentação e contato direto." },
  { to: "/loyalty", title: "Fidelidade", description: "Programa de pontos e cashback para reter e recompensar clientes." },
  { to: "/finance", title: "Financeiro", description: "Controle de receitas, despesas e fluxo de caixa do estabelecimento." },
  { to: "/ai", title: "Central de IA", description: "Insights automáticos e automações de marketing com inteligência artificial." },
  { to: "/consultor", title: "Consultor IA", description: "Tire dúvidas e receba recomendações estratégicas do consultor virtual." },
];

export function DemoTour() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
        // Start on dashboard
        if (pathname !== STEPS[0].to) navigate({ to: STEPS[0].to });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = useMemo(() => STEPS[index], [index]);

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setOpen(false);
  }

  function go(nextIndex: number) {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, nextIndex));
    setIndex(clamped);
    const target = STEPS[clamped].to;
    if (pathname !== target) navigate({ to: target });
  }

  if (!open) return null;

  const isLast = index === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/40 backdrop-blur-sm p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Passo {index + 1} de {STEPS.length}
          </span>
          <button
            onClick={finish}
            aria-label="Pular tour"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="text-lg font-semibold">{step.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>

        <div className="mt-4 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Pular tour
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => go(index - 1)}
              disabled={index === 0}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            {isLast ? (
              <Button size="sm" onClick={finish}>
                <Check className="mr-1 h-4 w-4" /> Concluir
              </Button>
            ) : (
              <Button size="sm" onClick={() => go(index + 1)}>
                Próximo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
