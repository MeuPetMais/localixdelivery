import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useOrdersRealtime } from "@/contexts/OrdersRealtimeContext";

/**
 * Banner persistente no topo do Dashboard quando há pedidos aguardando
 * confirmação. Clique navega para /orders (a coluna "Novo Pedido" já
 * é destacada pelo próprio Kanban).
 */
export function PendingOrdersBanner() {
  const { unseenCount } = useOrdersRealtime();
  if (unseenCount <= 0) return null;

  return (
    <Link
      to="/orders"
      className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-700 shadow-sm transition hover:bg-red-500/15 dark:text-red-300"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500 text-white animate-pulse">
        <AlertCircle className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">
          🔴 Você possui {unseenCount} pedido{unseenCount > 1 ? "s" : ""} aguardando confirmação.
        </p>
        <p className="text-xs opacity-80">Toque para abrir a tela de pedidos.</p>
      </div>
      <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
        Abrir
      </span>
    </Link>
  );
}
