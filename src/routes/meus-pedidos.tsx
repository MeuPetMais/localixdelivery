import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { searchOrdersByPhone } from "@/lib/public-orders.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { brl, onlyDigits } from "@/lib/format";
import { ArrowRight, Loader2, Phone, ShoppingBag, RotateCw } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({ phone: z.string().optional() });

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({ meta: [{ title: "Meus Pedidos — Localix" }] }),
  validateSearch: searchSchema,
  component: MyOrders,
});

type Order = {
  id: string; order_number: number | null; status: string; total: number;
  items: any; created_at: string; restaurant_id: string;
};

function MyOrders() {
  const { phone: initial } = Route.useSearch();
  const navigate = useNavigate();
  const fetchByPhone = useServerFn(searchOrdersByPhone);
  const [phone, setPhone] = useState(initial ?? "");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [restaurants, setRestaurants] = useState<Record<string, { name: string; slug: string }>>({});

  async function search(p: string) {
    const digits = onlyDigits(p);
    if (digits.length < 10) { toast.error("Digite um telefone válido com DDD"); return; }
    setLoading(true);
    try {
      const res = await fetchByPhone({ data: { phone: digits } });
      const data = res?.orders ?? [];
      setOrders(data as Order[]);
      const ids = Array.from(new Set(data.map((o: any) => o.restaurant_id)));
      if (ids.length) {
        const { data: rs } = await (supabase as any)
          .from("restaurants_public").select("id, name, slug").in("id", ids);
        const map: Record<string, { name: string; slug: string }> = {};
        for (const r of rs ?? []) map[r.id] = { name: r.name, slug: r.slug };
        setRestaurants(map);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao buscar pedidos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (initial) search(initial); /* eslint-disable-next-line */ }, []);

  function handleRepeat(o: Order) {
    const r = restaurants[o.restaurant_id];
    if (!r?.slug) return;
    const items = Array.isArray(o.items) ? o.items : [];
    try {
      sessionStorage.setItem(`repeat:${r.slug}`, JSON.stringify(items.map((it: any) => ({
        id: it.id, name: it.name, price: Number(it.price), qty: Number(it.qty),
      }))));
    } catch {}
    navigate({ to: "/$slug", params: { slug: r.slug } });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-xl font-extrabold">Meus pedidos</h1>
          <Link to="/home" className="text-xs text-muted-foreground hover:underline">Início</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <Card className="p-4">
          <form onSubmit={(e) => { e.preventDefault(); search(phone); }} className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 91234-5678" inputMode="tel" className="pl-9" />
            </div>
            <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}</Button>
          </form>
        </Card>

        {orders && orders.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido encontrado para este número.</Card>
        )}

        <div className="space-y-3">
          {orders?.map((o) => {
            const r = restaurants[o.restaurant_id];
            return (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      <p className="font-semibold">{r?.name ?? "Restaurante"}</p>
                      <span className="font-display text-xs font-bold text-primary">#{o.order_number}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-primary">{brl(Number(o.total))}</p>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate({ to: "/pedido/$id", params: { id: o.id } })}>
                    Acompanhar <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                  {r?.slug && (
                    <Button size="sm" variant="secondary" onClick={() => handleRepeat(o)}>
                      <RotateCw className="mr-1 h-4 w-4" /> Pedir novamente
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    novo: { label: "Recebido", cls: "bg-primary/10 text-primary border-primary/30" },
    em_preparo: { label: "Em Preparo", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    saiu_para_entrega: { label: "Saiu p/ Entrega", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
    entregue: { label: "Entregue", cls: "bg-success/15 text-success border-success/30" },
    cancelado: { label: "Cancelado", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  };
  const m = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
}
