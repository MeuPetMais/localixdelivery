import { useEffect, useState } from "react";
import type { OperationsOrderCard } from "@/lib/operations";

interface Props {
  cards: OperationsOrderCard[];
  onStart?: (c: OperationsOrderCard) => void;
  onFinish?: (c: OperationsOrderCard) => void;
}

/** Kitchen Display System — mostra pedidos ativos com cronômetro. */
export function KitchenDisplay({ cards, onStart, onFinish }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const active = cards.filter((c) =>
    ["aceito", "em_preparo", "pronto"].includes(c.status),
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {active.map((c) => {
        const ageMin = Math.max(0, Math.round((now - new Date(c.createdAt).getTime()) / 60000));
        return (
          <div key={c.id} className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{c.number}</h4>
              <span className="text-xs text-muted-foreground">{ageMin}min</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {(c.items ?? []).map((it) => (
                <li key={it.id} className="flex justify-between gap-2">
                  <span>{it.qty}× {it.name}</span>
                  {it.note && <span className="text-xs italic text-muted-foreground">{it.note}</span>}
                </li>
              ))}
              {!c.items?.length && <li className="text-xs text-muted-foreground">{c.itemsSummary}</li>}
            </ul>
            {c.observations && (
              <p className="mt-2 rounded-md bg-muted p-2 text-xs">{c.observations}</p>
            )}
            <div className="mt-3 flex gap-2">
              {c.status !== "em_preparo" && c.status !== "pronto" && (
                <button onClick={() => onStart?.(c)} className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                  Iniciar preparo
                </button>
              )}
              {c.status === "em_preparo" && (
                <button onClick={() => onFinish?.(c)} className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                  Finalizar preparo
                </button>
              )}
              {c.status === "pronto" && <span className="text-xs font-medium text-primary">Pronto</span>}
            </div>
          </div>
        );
      })}
      {active.length === 0 && (
        <p className="col-span-full py-6 text-center text-sm text-muted-foreground">Sem pedidos ativos.</p>
      )}
    </div>
  );
}
