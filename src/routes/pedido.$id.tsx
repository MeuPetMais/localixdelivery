import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getPublicOrderById } from "@/lib/public-orders.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { Loader2, Clock, MapPin, CreditCard, User, Phone, RotateCw, Store, CheckCircle2, Circle, ChefHat, Bike, PackageCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ReviewForm } from "@/components/ReviewForm";
import { useCustomerNavigation } from "@/contexts/CustomerNavigationContext";


export const Route = createFileRoute("/pedido/$id")({
  head: () => ({ meta: [{ title: "Acompanhar Pedido — Localix" }] }),
  component: TrackOrder,
});

type Order = {
  id: string;
  order_number: number | null;
  status: string;
  total: number;
  discount: number | null;
  items: any;
  customer_name: string;
  customer_phone: string;
  address: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
  estimated_delivery_time: number | null;
  restaurant_id: string;
};

type Restaurant = { id: string; name: string; slug: string; delivery_fee: number | null };

const STEPS = [
  { key: "novo", label: "Pedido Recebido", Icon: CheckCircle2 },
  { key: "em_preparo", label: "Em Preparo", Icon: ChefHat },
  { key: "saiu_para_entrega", label: "Saiu para Entrega", Icon: Bike },
  { key: "entregue", label: "Entregue", Icon: PackageCheck },
];

function statusIndex(status: string) {
  const i = STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function TrackOrder() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { restaurantPath } = useCustomerNavigation();
  const fetchOrder = useServerFn(getPublicOrderById);
  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const lastStatusRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load(initial = false) {
      try {
        const res = await fetchOrder({ data: { id } });
        if (!mounted) return;
        const next = (res?.order ?? null) as Order | null;
        if (!next) { if (initial) setLoading(false); return; }
        if (lastStatusRef.current && lastStatusRef.current !== next.status) {
          toast.success(`Status atualizado: ${labelOf(next.status)}`);
        }
        lastStatusRef.current = next.status;
        setOrder(next);
        if (initial) {
          const { data: r } = await (supabase as any)
            .from("restaurants_public")
            .select("id, name, slug, delivery_fee")
            .eq("id", next.restaurant_id)
            .maybeSingle();
          if (!mounted) return;
          setRestaurant(r as Restaurant);
          setLoading(false);
        }
      } catch {
        if (initial) setLoading(false);
      }
    }
    load(true);
    const poll = setInterval(() => load(false), 20000);
    const onFocus = () => load(false);
    window.addEventListener("focus", onFocus);
    return () => { mounted = false; clearInterval(poll); window.removeEventListener("focus", onFocus); };
  }, [id, fetchOrder]);

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!order) return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-lg font-bold">Pedido não encontrado</p>
        {restaurantPath ? (
          <Link to={restaurantPath as any} className="text-sm text-primary hover:underline">Voltar ao cardápio</Link>
        ) : (
          <Link to="/cliente" className="text-sm text-primary hover:underline">Voltar à minha conta</Link>
        )}
      </div>
    </div>
  );

  const cancelled = order.status === "cancelado";
  const currentIdx = statusIndex(order.status);
  const items: Array<{ name: string; price: number; qty: number }> = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const fee = Math.max(0, Number(order.total) - subtotal + Number(order.discount ?? 0));

  function handleRepeat() {
    if (!restaurant?.slug) return;
    try {
      sessionStorage.setItem(
        `repeat:${restaurant.slug}`,
        JSON.stringify(items.map((it: any) => ({ id: it.id, name: it.name, price: Number(it.price), qty: Number(it.qty) }))),
      );
    } catch {}
    navigate({ to: "/$slug", params: { slug: restaurant.slug } });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs text-muted-foreground">{restaurant?.name}</p>
            <h1 className="font-display text-xl font-extrabold">Pedido #{order.order_number}</h1>
          </div>
          <Badge variant={cancelled ? "destructive" : "secondary"} className="capitalize">{labelOf(order.status)}</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        {/* Timeline */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Acompanhamento</h2>
            {!cancelled && order.estimated_delivery_time && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> ~{order.estimated_delivery_time} min
              </span>
            )}
          </div>
          {cancelled ? (
            <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-destructive">
              <XCircle className="h-5 w-5" />
              <p className="font-semibold">Este pedido foi cancelado.</p>
            </div>
          ) : (
            <ol className="space-y-4">
              {STEPS.map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                const Icon = s.Icon;
                return (
                  <li key={s.key} className="flex items-start gap-3">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 ${done ? "border-success bg-success/15 text-success" : active ? "border-primary bg-primary/15 text-primary animate-pulse" : "border-muted bg-muted/30 text-muted-foreground"}`}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Icon className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className={`font-medium ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                      {active && <p className="text-xs text-muted-foreground">Atualizado em {new Date(order.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {/* Items */}
        <Card className="p-5">
          <h2 className="mb-3 font-display text-lg font-bold">Itens do pedido</h2>
          <ul className="space-y-2 text-sm">
            {items.map((it: any, i: number) => (
              <li key={i} className="flex items-center justify-between">
                <span>{it.qty}x {it.name}</span>
                <span className="text-muted-foreground">{brl(Number(it.price) * Number(it.qty))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <Row label="Subtotal" value={brl(subtotal)} />
            {Number(order.discount ?? 0) > 0 && <Row label="Desconto" value={`- ${brl(Number(order.discount))}`} />}
            <Row label="Entrega" value={brl(fee)} />
            <div className="flex justify-between pt-1 font-display text-base font-extrabold">
              <span>Total</span><span className="text-primary">{brl(Number(order.total))}</span>
            </div>
          </div>
        </Card>

        {/* Info */}
        <Card className="p-5 space-y-2 text-sm">
          <h2 className="mb-2 font-display text-lg font-bold">Entrega</h2>
          <InfoRow Icon={User} label="Cliente" value={order.customer_name} />
          <InfoRow Icon={Phone} label="Telefone" value={order.customer_phone} />
          <InfoRow Icon={MapPin} label="Endereço" value={order.address} />
          <InfoRow Icon={CreditCard} label="Pagamento" value={order.payment_method} />
          <InfoRow Icon={Clock} label="Pedido em" value={new Date(order.created_at).toLocaleString("pt-BR")} />
        </Card>

        {order.status === "entregue" && (
          <ReviewForm
            orderId={order.id}
            restaurantId={order.restaurant_id}
            customerName={order.customer_name}
            customerPhone={order.customer_phone}
          />
        )}


        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={handleRepeat} disabled={!restaurant?.slug}>
            <RotateCw className="mr-1.5 h-4 w-4" /> Pedir novamente
          </Button>
          <Button variant="secondary" onClick={() => navigate({ to: "/meus-pedidos" })}>
            <Store className="mr-1.5 h-4 w-4" /> Meus pedidos
          </Button>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-muted-foreground"><span>{label}</span><span>{value}</span></div>;
}
function InfoRow({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>
    </div>
  );
}
function labelOf(s: string) {
  return ({ novo: "Recebido", em_preparo: "Em Preparo", saiu_para_entrega: "Saiu para Entrega", entregue: "Entregue", cancelado: "Cancelado" } as any)[s] ?? s;
}
