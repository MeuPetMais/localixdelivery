import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { Loader2, Phone, MapPin, Clock, CircleDot } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "Pedidos — Localix" }] }),
  component: OrdersPage,
});

type Order = {
  id: string;
  order_number: number | null;
  restaurant_id: string;
  customer_name: string;
  customer_phone: string | null;
  address: string | null;
  payment_method: string | null;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
  status: string;
  created_at: string;
};


const STATUSES = [
  { key: "novo", label: "Novo Pedido", tone: "bg-primary/10 text-primary border-primary/30" },
  { key: "em_preparo", label: "Em Preparo", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  { key: "saiu_para_entrega", label: "Saiu para Entrega", tone: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" },
  { key: "entregue", label: "Entregue", tone: "bg-success/15 text-success border-success/30" },
  { key: "cancelado", label: "Cancelado", tone: "bg-destructive/10 text-destructive border-destructive/30" },
] as const;

const NEXT: Record<string, string | null> = {
  novo: "em_preparo",
  em_preparo: "saiu_para_entrega",
  saiu_para_entrega: "entregue",
  entregue: null,
  cancelado: null,
};

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: rest } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", auth.user.id)
        .maybeSingle();
      const restaurantId = rest?.id;
      if (!restaurantId) {
        if (active) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      if (error) toast.error("Falha ao carregar pedidos");
      setOrders((data ?? []) as any);
      setLoading(false);

      channel = supabase
        .channel(`orders-realtime-${restaurantId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
          (payload) => {
            setOrders((prev) => {
              if (payload.eventType === "INSERT") {
                const n = (payload.new as Order).order_number;
                toast.success(n ? `Novo pedido #${n} recebido!` : "Novo pedido recebido!");
                return [payload.new as Order, ...prev];
              }

              if (payload.eventType === "UPDATE") {
                return prev.map((o) => (o.id === (payload.new as Order).id ? (payload.new as Order) : o));
              }
              if (payload.eventType === "DELETE") {
                return prev.filter((o) => o.id !== (payload.old as Order).id);
              }
              return prev;
            });
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);


  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("Não foi possível atualizar");
  }

  const grouped = useMemo(() => {
    const g: Record<string, Order[]> = {};
    for (const s of STATUSES) g[s.key] = [];
    for (const o of orders) (g[o.status] ?? (g[o.status] = [])).push(o);
    return g;
  }, [orders]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Atualização em tempo real conforme entram novos pedidos.</p>
        </div>
        <Badge variant="outline" className="gap-1.5"><CircleDot className="h-3 w-3 text-success animate-pulse" /> Ao vivo</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {STATUSES.map((s) => (
          <div key={s.key} className="space-y-3">
            <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${s.tone}`}>
              <span className="text-sm font-semibold">{s.label}</span>
              <span className="text-xs font-bold">{grouped[s.key].length}</span>
            </div>
            <div className="space-y-3">
              {grouped[s.key].length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Nenhum pedido</p>
              )}
              {grouped[s.key].map((o) => {
                const next = NEXT[o.status];
                return (
                  <Card key={o.id} className="space-y-2 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{o.customer_name}</p>
                      <span className="font-display text-sm font-bold text-primary">{brl(Number(o.total))}</span>
                    </div>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {o.customer_phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {o.customer_phone}</p>}
                      {o.address && <p className="flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5" /> {o.address}</p>}
                      <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <ul className="rounded-md bg-muted/50 p-2 text-xs">
                      {(Array.isArray(o.items) ? o.items : []).map((it, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{it.qty}x {it.name}</span>
                          <span>{brl(Number(it.price) * it.qty)}</span>
                        </li>
                      ))}
                    </ul>
                    {o.payment_method && <p className="text-xs"><span className="text-muted-foreground">Pagto:</span> {o.payment_method}</p>}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {next && (
                        <Button size="sm" className="h-7 text-xs" onClick={() => updateStatus(o.id, next)}>
                          {STATUSES.find((x) => x.key === next)?.label}
                        </Button>
                      )}
                      {o.status !== "entregue" && o.status !== "cancelado" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(o.id, "cancelado")}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
