import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getPublicOrderById } from "@/lib/public-orders.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { CheckCircle2, Clock, CreditCard, Loader2, MapPin, ArrowRight, Store, Gift } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/pedido-sucesso/$id")({
  head: () => ({ meta: [{ title: "Pedido recebido — Localix" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchOrder = useServerFn(getPublicOrderById);
  const [order, setOrder] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const res = await fetchOrder({ data: { id } });
      const data = res?.order;
      if (!data) return;
      setOrder(data);
      const { data: r } = await (supabase as any)
        .from("restaurants_public").select("id, name, slug").eq("id", data.restaurant_id).maybeSingle();
      setRestaurant(r);
    })();
  }, [id, fetchOrder]);

  if (!order) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-success/5 via-background to-muted/30">
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success animate-in zoom-in">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="font-display text-3xl font-extrabold">🎉 Pedido Recebido</h1>
          <p className="mt-1 text-sm text-muted-foreground">{restaurant?.name ?? "Restaurante"}</p>
        </div>

        <Card className="mt-6 p-6 text-center shadow-lg">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Número do pedido</p>
          <p className="font-display text-4xl font-extrabold text-primary">#{order.order_number}</p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-left">
            <Tile Icon={Clock} label="Tempo estimado" value={`${order.estimated_delivery_time ?? 35} min`} />
            <Tile Icon={CreditCard} label="Pagamento" value={order.payment_method} />
            <Tile Icon={MapPin} label="Entrega" value={order.address} full />
          </div>

          <div className="mt-5 border-t pt-4">
            <p className="text-xs text-muted-foreground">Valor total</p>
            <p className="font-display text-2xl font-extrabold">{brl(Number(order.total))}</p>
          </div>

          <div className="mt-6 grid gap-2">
            <Button size="lg" onClick={() => navigate({ to: "/pedido/$id", params: { id } })}>
              Acompanhar pedido <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            {restaurant?.slug && (
              <Button variant="outline" onClick={() => navigate({ to: "/r/$slug", params: { slug: restaurant.slug } })}>
                <Store className="mr-1.5 h-4 w-4" /> Fazer novo pedido
              </Button>
            )}
          </div>
        </Card>

        {!user && (
          <Card className="mt-4 border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Gift className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Crie sua conta em 30 segundos</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Acompanhe pedidos, acumule pontos e receba ofertas exclusivas. Seu pedido já está garantido.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => navigate({ to: "/auth" })}>Criar conta</Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/pedido/$id", params: { id } })}>
                    Agora não
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/meus-pedidos" className="hover:underline">Ver meus pedidos</Link>
        </p>

      </main>
    </div>
  );
}

function Tile({ Icon, label, value, full }: { Icon: any; label: string; value: string; full?: boolean }) {
  return (
    <div className={`rounded-xl border bg-muted/30 p-3 ${full ? "col-span-2" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3 w-3" /> {label}</div>
      <p className="mt-0.5 truncate font-semibold">{value}</p>
    </div>
  );
}
