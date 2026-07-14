import { paymentMethodLabel } from "@/lib/checkout/paymentMethodLabel";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import {
  Loader2, Maximize, Minimize, ChefHat, Clock, Utensils, Bike, CheckCircle2, X,
} from "lucide-react";
import { computeEtaMinutes, computeEtaLabel } from "@/lib/smart-eta";
import { toast } from "sonner";
import { transitionOrderStatus } from "@/lib/orders/orders.functions";
import type { OrderState } from "@/lib/orders/OrderStateMachine";

export const Route = createFileRoute("/_authenticated/kitchen")({
  head: () => ({ meta: [{ title: "Painel da Cozinha — Localix" }] }),
  component: KitchenPage,
});

type Order = {
  id: string;
  order_number: number | null;
  customer_name: string;
  items: Array<{ name: string; qty: number; price: number; notes?: string | null }>;
  total: number;
  status: string;
  payment_method: string | null;
  created_at: string;
};

type Col = { key: Order["status"]; title: string; emoji: string; accent: string };

const COLUMNS: Col[] = [
  { key: "aceito",            title: "Aceitos",    emoji: "🆕", accent: "bg-red-500/10 border-red-500/30" },
  { key: "em_preparo",        title: "Preparando", emoji: "👨‍🍳", accent: "bg-amber-500/10 border-amber-500/30" },
  { key: "pronto",            title: "Pronto",     emoji: "✅", accent: "bg-emerald-500/10 border-emerald-500/30" },
  { key: "saiu_para_entrega", title: "Entrega",    emoji: "🛵", accent: "bg-blue-500/10 border-blue-500/30" },
  { key: "entregue",          title: "Entregue",   emoji: "🏁", accent: "bg-slate-500/10 border-slate-500/30" },
];

const NEXT_STATUS: Record<string, string> = {
  aceito: "em_preparo",
  em_preparo: "pronto",
  pronto: "saiu_para_entrega",
  saiu_para_entrega: "entregue",
};

function elapsed(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function KitchenPage() {
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const [tv, setTv] = useState(false);
  const [, tick] = useState(0);

  // Re-render a cada 30s para atualizar o tempo decorrido.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["kitchen", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, items, total, status, payment_method, created_at")
        .eq("restaurant_id", restaurant!.id)
        .in("status", ["aceito", "em_preparo", "pronto", "saiu_para_entrega"])
        .order("created_at", { ascending: true })
        .limit(200);
      return (data ?? []) as Order[];
    },
  });

  // Realtime: patch cirúrgico no cache da própria tela.
  useEffect(() => {
    if (!restaurant?.id) return;
    const ch = supabase
      .channel(`kitchen-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => qc.invalidateQueries({ queryKey: ["kitchen", restaurant.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurant?.id, qc]);

  const grouped = useMemo(() => {
    const map: Record<string, Order[]> = {};
    for (const c of COLUMNS) map[c.key] = [];
    (orders ?? []).forEach((o) => {
      if (map[o.status]) map[o.status].push(o);
    });
    return map;
  }, [orders]);

  const etaMinutes = useMemo(() => {
    return computeEtaMinutes({
      queueCount: grouped["aceito"]?.length ?? 0,
      preparingCount: grouped["em_preparo"]?.length ?? 0,
      cooks: 1,
      avgPrepMinutes: 20,
      deliveryMinutes: restaurant?.avg_delivery_minutes ?? 15,
    });
  }, [grouped, restaurant?.avg_delivery_minutes]);

  // Sincroniza `delivery_time` do restaurante quando muda o bucket estimado.
  useEffect(() => {
    if (!restaurant?.id) return;
    const target = computeEtaLabel(etaMinutes);
    if (restaurant.delivery_time === target) return;
    supabase.from("restaurants").update({ delivery_time: target }).eq("id", restaurant.id).then(() => {});
  }, [etaMinutes, restaurant?.id, restaurant?.delivery_time]);

  async function advance(o: Order) {
    const next = NEXT_STATUS[o.status];
    if (!next) return;
    try {
      await transitionOrderStatus({ data: { orderId: o.id, to: next as OrderState } });
    } catch {
      toast.error("Não foi possível atualizar");
    }
  }

  async function cancel(o: Order) {
    try {
      await transitionOrderStatus({ data: { orderId: o.id, to: "cancelado" } });
    } catch {
      toast.error("Não foi possível cancelar");
    }
  }

  function toggleFullscreen() {
    const doc: any = document;
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen?.() ??
        doc.documentElement.webkitRequestFullscreen?.())?.catch?.(() => {});
      setTv(true);
    } else {
      (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())?.catch?.(() => {});
      setTv(false);
    }
  }

  useEffect(() => {
    const onFs = () => setTv(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={tv ? "fixed inset-0 z-[100] overflow-auto bg-background p-4" : ""}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <ChefHat className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold">Painel da Cozinha</h1>
            <p className="text-sm text-muted-foreground">
              Tempo estimado atual: <strong>{computeEtaLabel(etaMinutes)}</strong>
            </p>
          </div>
        </div>
        <Button onClick={toggleFullscreen} variant={tv ? "default" : "outline"}>
          {tv ? <><Minimize className="mr-2 h-4 w-4" /> Sair do Modo TV</> : <><Maximize className="mr-2 h-4 w-4" /> Modo Cozinha</>}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const list = grouped[col.key] ?? [];
          return (
            <div key={col.key} className={`rounded-2xl border-2 p-3 ${col.accent}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide">
                  {col.emoji} {col.title}
                </h2>
                <Badge variant="secondary">{list.length}</Badge>
              </div>
              <div className="space-y-3">
                {list.length === 0 && (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Vazio
                  </p>
                )}
                {list.map((o) => (
                  <Card key={o.id} className="p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-display text-2xl font-extrabold leading-none">
                        #{o.order_number ?? "—"}
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> {elapsed(o.created_at)}
                      </span>
                    </div>
                    <p className="mb-1 text-sm font-semibold">{o.customer_name}</p>
                    <ul className="mb-2 space-y-1 text-sm">
                      {o.items?.map((it, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="font-bold text-primary">{it.qty}x</span>
                          <span className="flex-1">
                            {it.name}
                            {it.notes && (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                obs.: {it.notes}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{paymentMethodLabel(o.payment_method)}</span>
                      <strong className="text-foreground">{brl(Number(o.total))}</strong>
                    </div>
                    <div className="flex gap-2">
                      {NEXT_STATUS[o.status] && (
                        <Button size="sm" className="flex-1" onClick={() => advance(o)}>
                          {o.status === "aceito" && (<><Utensils className="mr-1 h-4 w-4" /> Preparar</>)}
                          {o.status === "em_preparo" && (<><CheckCircle2 className="mr-1 h-4 w-4" /> Pronto</>)}
                          {o.status === "pronto" && (<><Bike className="mr-1 h-4 w-4" /> Saiu</>)}
                          {o.status === "saiu_para_entrega" && (<><CheckCircle2 className="mr-1 h-4 w-4" /> Entregue</>)}
                        </Button>
                      )}
                      {o.status === "aceito" && (
                        <Button size="sm" variant="ghost" onClick={() => cancel(o)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
