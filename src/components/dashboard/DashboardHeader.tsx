import { Search, Bell, User } from "lucide-react";
import type { DashboardRestaurantStatus } from "@/lib/dashboard";
import { getDashboardStatusLabel } from "@/lib/restaurant-status-labels";

interface Props {
  restaurantName: string;
  status?: DashboardRestaurantStatus;
  onSearch?: (q: string) => void;
  onOpenNotifications?: () => void;
  onOpenUserMenu?: () => void;
  scheduleLabel?: string;
}

export function DashboardHeader({
  restaurantName, status, onSearch, onOpenNotifications, onOpenUserMenu, scheduleLabel,
}: Props) {
  const statusLabel = getDashboardStatusLabel(status);

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background px-4 py-2 sm:flex sm:flex-wrap sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold sm:text-lg">{restaurantName}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {statusLabel}
            {status?.acceptingOrders ? " • Aceitando pedidos" : ""}
            {scheduleLabel ? ` • ${scheduleLabel}` : ""}
            {status?.deliveryMode ? ` • ${status.deliveryMode}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar…"
            onChange={(e) => onSearch?.(e.target.value)}
            className="h-9 rounded-lg border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button aria-label="Notificações" onClick={onOpenNotifications} className="rounded-full p-2 hover:bg-muted">
          <Bell className="h-5 w-5" />
        </button>
        <button aria-label="Usuário" onClick={onOpenUserMenu} className="rounded-full p-2 hover:bg-muted">
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
