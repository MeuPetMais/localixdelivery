import { canPerform, type OperationsAction, type OperationsRole } from "@/lib/operations";

interface Props {
  role: OperationsRole;
  onAction: (action: OperationsAction) => void;
}

const BUTTONS: { action: OperationsAction; label: string }[] = [
  { action: "ACCEPT", label: "Aceitar" },
  { action: "REJECT", label: "Recusar" },
  { action: "START_PREP", label: "Iniciar Preparo" },
  { action: "FINISH_PREP", label: "Finalizar Preparo" },
  { action: "DISPATCH", label: "Despachar" },
  { action: "MARK_DELIVERED", label: "Entregue" },
  { action: "CANCEL", label: "Cancelar" },
];

export function OperationsQuickActions({ role, onAction }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {BUTTONS.filter((b) => canPerform(role, b.action)).map((b) => (
        <button
          key={b.action}
          onClick={() => onAction(b.action)}
          className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
