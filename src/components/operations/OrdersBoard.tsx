import { OPERATIONS_COLUMNS } from "@/lib/operations";
import type { OperationsOrderCard } from "@/lib/operations";
import { columnForState } from "@/lib/operations";
import { cn } from "@/lib/utils";
import { paymentMethodLabel } from "@/lib/checkout/paymentMethodLabel";

interface Props {
  cards: OperationsOrderCard[];
  onCardClick?: (c: OperationsOrderCard) => void;
}

const PRIORITY_COLOR = {
  URGENT: "border-l-destructive",
  NORMAL: "border-l-primary",
  LOW: "border-l-muted",
} as const;

export function OrdersBoard({ cards, onCardClick }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {OPERATIONS_COLUMNS.map((col) => {
        const items = cards.filter((c) => columnForState(c.status) === col.id);
        return (
          <div key={col.id} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">{col.label}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{items.length}</span>
            </div>
            <ul className="space-y-2">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => onCardClick?.(c)}
                    className={cn(
                      "w-full rounded-lg border border-l-4 bg-card p-3 text-left shadow-sm hover:bg-muted/40",
                      PRIORITY_COLOR[c.priority],
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{c.number}</span>
                      <span className="text-xs text-muted-foreground">
                        R$ {c.total.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm">{c.customerName}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.itemsSummary}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] uppercase text-muted-foreground">
                      <span>{paymentMethodLabel(c.paymentMethod)}</span>
                      <span>{c.deliveryMode}</span>
                      <span>{c.priority}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
