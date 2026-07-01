import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, ArrowRight } from "lucide-react";
import { brl } from "@/lib/format";
import { useOrdersRealtime } from "@/contexts/OrdersRealtimeContext";

function timeAgo(iso: string) {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  return `há ${Math.floor(diff / 3600)}h`;
}

export function NewOrderCard() {
  const { latestNew, acceptLatest } = useOrdersRealtime();
  const [, force] = useState(0);

  useEffect(() => {
    if (!latestNew) return;
    const t = setInterval(() => force((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [latestNew]);

  if (!latestNew) return null;

  return (
    <Card className="relative overflow-hidden border-primary/40 bg-primary/5 p-5 shadow-glow">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl animate-pulse" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
          <Bell className="h-5 w-5 animate-bounce" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">🛎️ Novo pedido</p>
          <p className="font-display text-lg font-bold">
            Pedido #{latestNew.order_number ?? "—"} · {latestNew.customer_name}
          </p>
          <p className="text-sm text-muted-foreground">
            {brl(Number(latestNew.total))} · Recebido {timeAgo(latestNew.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => acceptLatest()}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Aceitar
          </Button>
          <Link to="/orders">
            <Button size="sm" variant="outline">
              Ver pedido <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
