import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/format";
import { ArrowLeft, Archive, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/order-history")({
  head: () => ({ meta: [{ title: "Historico de pedidos — Localix" }] }),
  component: OrderHistoryPage,
});

type HistoricalOrder = {
  id: string;
  order_number: number | null;
  customer_name: string;
  customer_phone: string | null;
  payment_method: string | null;
  total: number;
  status: string;
  created_at: string;
  updated_at: string | null;
};

const TERMINAL_HISTORY_STATUSES = [
  "concluido",
  "cancelado",
  "rejeitado",
  "reembolsado",
  "chargeback",
] as const;

const STATUS_LABELS: Record<string, string> = {
  concluido: "Concluido",
  cancelado: "Cancelado",
  rejeitado: "Rejeitado",
  reembolsado: "Reembolsado",
  chargeback: "Chargeback",
};

function cutoffIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function OrderHistoryPage() {
  const restaurant = useRestaurant();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const ninetyDaysAgo = useMemo(() => cutoffIso(90), []);

  const { data: orders = [], isLoading } = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["order-history", restaurant?.id, ninetyDaysAgo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_phone, payment_method, total, status, created_at, updated_at",
        )
        .eq("restaurant_id", restaurant.id)
        .in("status", [...TERMINAL_HISTORY_STATUSES])
        .gte("updated_at", ninetyDaysAgo)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data ?? []) as HistoricalOrder[];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, "");

    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!q) return true;

      const byNumber = String(order.order_number ?? "").includes(qDigits || q);
      const byName = order.customer_name?.toLowerCase().includes(q);
      const byPhone = qDigits
        ? (order.customer_phone ?? "").replace(/\D+/g, "").includes(qDigits)
        : false;

      return byNumber || byName || byPhone;
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Historico de pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos concluidos e cancelados ficam disponiveis por 90 dias para consulta operacional.
          </p>
        </div>
        <Button variant="outline" onClick={() => (window.location.href = "/orders")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar aos pedidos
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por pedido, cliente ou telefone"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", ...TERMINAL_HISTORY_STATUSES].map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={statusFilter === status ? "default" : "outline"}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "Todos" : STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Carregando historico...</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Archive className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Nenhum pedido encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O historico mostra somente pedidos terminais dos ultimos 90 dias.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Pedido #{order.order_number ?? "—"}</span>
                    <Badge variant={order.status === "concluido" ? "default" : "secondary"}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {order.customer_name || "Cliente"}
                    {order.customer_phone ? ` • ${order.customer_phone}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Encerrado em {new Date(order.updated_at ?? order.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-semibold">{brl(Number(order.total || 0))}</p>
                  <p className="text-xs text-muted-foreground">{order.payment_method ?? "Pagamento nao informado"}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        A janela de 90 dias afeta apenas a consulta operacional. Nenhum registro financeiro ou de auditoria e apagado por esta tela.
      </p>
    </div>
  );
}
