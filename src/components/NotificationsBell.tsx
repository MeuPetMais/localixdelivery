import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useCustomerNotifications,
  type CustomerNotification,
} from "@/contexts/CustomerNotificationsContext";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const { isAuthenticated } = useCustomerAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useCustomerNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  async function handleOpen(n: CustomerNotification) {
    if (!n.read_at) await markRead(n.id);
    setOpen(false);
    if (n.order_id) {
      navigate({ to: "/pedido/$id", params: { id: n.order_id } });
    }
  }

  return (
    <div
      className="fixed right-3 z-50"
      style={{ top: "calc(12px + env(safe-area-inset-top))" }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="Notificações"
            className="relative grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[20px] rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-5 text-white ring-2 ring-background">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-[92vw] max-w-sm p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Notificações</h3>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Tudo em dia"}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAllRead()}>
                <Check className="mr-1 h-3.5 w-3.5" /> Marcar todas
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-[60vh]">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Você ainda não tem notificações.
              </div>
            ) : (
              <ul className="divide-y">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleOpen(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-accent/50",
                        !n.read_at && "bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          n.read_at ? "bg-transparent" : "bg-primary",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                          {n.order_id && " · Ver pedido"}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
