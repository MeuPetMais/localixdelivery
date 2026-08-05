import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listInternalNotifications, markInternalNotificationRead } from "@/lib/support-admin.functions";

type InternalNotification = {
  id: string;
  template_code: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  payload_json: Record<string, any>;
  read_at: string | null;
  created_at: string;
};

const TITLE_BY_TEMPLATE: Record<string, string> = {
  SUPPORT_TICKET_CREATED: "Novo chamado",
  SUPPORT_TICKET_URGENT: "Chamado urgente",
  SUPPORT_MESSAGE_FROM_MERCHANT: "Nova mensagem",
  SUPPORT_TICKET_ASSIGNED: "Chamado atribuido",
  SUPPORT_TICKET_TRANSFERRED: "Chamado transferido",
  SUPPORT_SLA_NEAR_DUE: "SLA proximo",
  SUPPORT_SLA_BREACHED: "SLA vencido",
  SUPPORT_CUSTOMER_REPLIED: "Cliente respondeu",
  SUPPORT_TICKET_REOPENED: "Chamado reaberto",
};

export function InternalNotificationsBell() {
  const listFn = useServerFn(listInternalNotifications);
  const markFn = useServerFn(markInternalNotificationRead);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-internal-notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
    retry: false,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-internal-notifications"] }),
  });

  const notifications = (query.data ?? []) as InternalNotification[];
  const unread = notifications.filter((notification) => !notification.read_at).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-200 hover:bg-slate-800 hover:text-white">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 border-slate-800 bg-slate-900 p-0 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <div className="text-sm font-semibold">Notificacoes internas</div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-slate-300"
            disabled={unread === 0}
            onClick={() => notifications.filter((notification) => !notification.read_at).forEach((notification) => markRead.mutate(notification.id))}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Ler todas
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">Nenhuma notificacao.</div>
          ) : notifications.map((notification) => {
            const ticketId = notification.payload_json?.ticket_id;
            return (
              <div key={notification.id} className={`border-b border-slate-800 p-3 last:border-0 ${notification.read_at ? "" : "bg-primary/10"}`}>
                <div className="flex items-start gap-2">
                  <LifeBuoy className={`mt-0.5 h-4 w-4 ${notification.priority === "CRITICAL" ? "text-red-300" : "text-primary"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{TITLE_BY_TEMPLATE[notification.template_code] ?? notification.template_code}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-400">
                      #{notification.payload_json?.ticket_number ?? "-"} {notification.payload_json?.subject ?? ""}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {ticketId && (
                        <Button asChild size="sm" className="h-7 px-2 text-xs" onClick={() => markRead.mutate(notification.id)}>
                          <Link to="/admin/support/$ticketId" params={{ ticketId }}>
                            Abrir chamado
                          </Link>
                        </Button>
                      )}
                      {!notification.read_at && (
                        <Button size="sm" variant="outline" className="h-7 border-slate-700 px-2 text-xs text-slate-200" onClick={() => markRead.mutate(notification.id)}>
                          Marcar lida
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
