import { DashboardAudit } from "@/lib/dashboard";

export interface QuickAction {
  id: string;
  label: string;
  onClick: () => void;
}

export function QuickActions({ actions, restaurantId }: { actions: QuickAction[]; restaurantId?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.id}
          onClick={() => {
            DashboardAudit.record({ type: "QUICK_ACTION", restaurantId, payload: { id: a.id } });
            a.onClick();
          }}
          className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export const defaultQuickActions = (handlers: Partial<Record<string, () => void>>): QuickAction[] => [
  { id: "new-product", label: "Novo Produto", onClick: handlers["new-product"] ?? (() => {}) },
  { id: "new-coupon", label: "Novo Cupom", onClick: handlers["new-coupon"] ?? (() => {}) },
  { id: "toggle-open", label: "Abrir/Fechar", onClick: handlers["toggle-open"] ?? (() => {}) },
  { id: "delivery-mode", label: "Modo Entrega", onClick: handlers["delivery-mode"] ?? (() => {}) },
  { id: "view-orders", label: "Ver Pedidos", onClick: handlers["view-orders"] ?? (() => {}) },
];
