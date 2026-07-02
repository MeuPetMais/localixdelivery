import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Package, Star, LifeBuoy, XCircle, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";

type Kind = "order_new" | "order_cancel" | "review" | "support_reply";
type Item = {
  id: string;
  kind: Kind;
  title: string;
  detail: string;
  href: string;
  at: string;
  priority: "high" | "normal" | "low";
};

const READ_KEY = (rid: string) => `localix:notify:read:${rid}`;

function loadRead(rid: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY(rid)) ?? "[]"));
  } catch {
    return new Set();
  }
}
function saveRead(rid: string, s: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(READ_KEY(rid), JSON.stringify(Array.from(s).slice(-500)));
}

export function MerchantNotificationsBell({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const [readIds, setReadIds] = useState<Set<string>>(() => loadRead(restaurantId));

  const query = useQuery({
    enabled: !!restaurantId,
    queryKey: ["merchant-notifications", restaurantId],
    queryFn: async (): Promise<Item[]> => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [orders, reviews, tickets] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, customer_name, total, status, created_at, updated_at")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("reviews")
          .select("id, rating, comment, created_at, customer_name")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("support_tickets")
          .select("id, ticket_number, subject, status, last_message_at")
          .eq("restaurant_id", restaurantId)
          .in("status", ["respondido"])
          .gte("last_message_at", since)
          .order("last_message_at", { ascending: false })
          .limit(15),
      ]);

      const items: Item[] = [];
      for (const o of orders.data ?? []) {
        const isCancel = o.status === "cancelado";
        items.push({
          id: `order:${o.id}:${isCancel ? "c" : "n"}`,
          kind: isCancel ? "order_cancel" : "order_new",
          title: isCancel ? "Pedido cancelado" : `Novo pedido #${o.order_number ?? ""}`.trim(),
          detail: `${o.customer_name ?? "Cliente"} — ${brl(Number(o.total ?? 0))}`,
          href: "/orders",
          at: (isCancel ? o.updated_at : o.created_at) as string,
          priority: isCancel ? "high" : "high",
        });
      }
      for (const r of reviews.data ?? []) {
        items.push({
          id: `review:${r.id}`,
          kind: "review",
          title: `Nova avaliação (${r.rating}★)`,
          detail: (r.comment ?? "").slice(0, 80) || `Cliente: ${r.customer_name ?? "—"}`,
          href: "/reviews",
          at: r.created_at as string,
          priority: (r.rating ?? 5) <= 2 ? "high" : "normal",
        });
      }
      for (const t of tickets.data ?? []) {
        items.push({
          id: `ticket:${t.id}`,
          kind: "support_reply",
          title: `Suporte respondeu #${t.ticket_number ?? ""}`.trim(),
          detail: t.subject,
          href: "/support",
          at: t.last_message_at as string,
          priority: "normal",
        });
      }
      return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 40);
    },
    refetchInterval: 60_000,
  });

  // Realtime: nova avaliação / pedido / atualização de ticket
  useEffect(() => {
    if (!restaurantId) return;
    const invalidate = () =>
      qc.invalidateQueries({ queryKey: ["merchant-notifications", restaurantId] });
    const ch = supabase
      .channel(`merchant-notify-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, invalidate)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reviews", filter: `restaurant_id=eq.${restaurantId}` }, invalidate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `restaurant_id=eq.${restaurantId}` }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurantId, qc]);

  const items = query.data ?? [];
  const unread = useMemo(() => items.filter((i) => !readIds.has(i.id)), [items, readIds]);
  const unreadCount = unread.length;

  function markAllRead() {
    const next = new Set(readIds);
    for (const i of items) next.add(i.id);
    setReadIds(next);
    saveRead(restaurantId, next);
  }
  function markOneRead(id: string) {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveRead(restaurantId, next);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notificações"
          className="relative grid h-9 w-9 place-items-center rounded-lg border bg-background shadow-sm transition hover:bg-accent"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div>
            <div className="text-sm font-semibold">Notificações</div>
            <div className="text-[11px] text-muted-foreground">
              {unreadCount === 0 ? "Você está em dia" : `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}`}
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={markAllRead} disabled={unreadCount === 0} className="h-7 gap-1 px-2 text-xs">
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sem notificações nos últimos 7 dias.
            </div>
          ) : (
            items.map((n) => {
              const isRead = readIds.has(n.id);
              const Icon =
                n.kind === "order_new" ? Package :
                n.kind === "order_cancel" ? XCircle :
                n.kind === "review" ? Star : LifeBuoy;
              const dot =
                n.priority === "high" ? "bg-red-500" : n.priority === "normal" ? "bg-amber-500" : "bg-muted-foreground";
              return (
                <Link
                  key={n.id}
                  to={n.href}
                  onClick={() => markOneRead(n.id)}
                  className={`flex gap-3 border-b p-3 last:border-0 transition hover:bg-accent/50 ${isRead ? "opacity-60" : ""}`}
                >
                  <div className="relative mt-0.5">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    {!isRead && <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${dot}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{n.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{n.detail}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(n.at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
