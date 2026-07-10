// CustomerTrackingTimeline — Barra operacional visual (mobile-first).

import { CheckCircle2, Circle, ChefHat, PackageCheck, Bike, Utensils } from "lucide-react";
import { CUSTOMER_STEPS } from "./customer-tracking.builder";
import type { CustomerTrackingStep } from "./customer-tracking.types";

const STEP_ICONS: Record<(typeof CUSTOMER_STEPS)[number]["key"], typeof CheckCircle2> = {
  pedido_recebido: CheckCircle2,
  em_preparo: ChefHat,
  pronto: Utensils,
  saiu_para_entrega: Bike,
  entregue: PackageCheck,
};

function activeIndex(step: CustomerTrackingStep): number {
  if (step === "proximo_do_destino") return CUSTOMER_STEPS.findIndex((s) => s.key === "saiu_para_entrega");
  const i = CUSTOMER_STEPS.findIndex((s) => s.key === step);
  return i === -1 ? 0 : i;
}

export function CustomerTrackingTimeline({ step }: { step: CustomerTrackingStep }) {
  const idx = activeIndex(step);
  return (
    <ol className="space-y-3" aria-label="Progresso do pedido">
      {CUSTOMER_STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const Icon = STEP_ICONS[s.key];
        return (
          <li key={s.key} className="flex items-center gap-3">
            <div
              className={[
                "grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300",
                done && "border-success bg-success/15 text-success",
                active && "border-primary bg-primary/15 text-primary animate-pulse",
                !done && !active && "border-muted bg-muted/30 text-muted-foreground",
              ].filter(Boolean).join(" ")}
              aria-current={active ? "step" : undefined}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Icon className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
