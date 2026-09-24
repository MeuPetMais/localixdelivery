import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { listCustomer360, getCustomer360 } from "@/lib/customer360.functions";
import type { Customer360Lifecycle } from "@/lib/customer360";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import {
  Users,
  Search,
  Loader2,
  Repeat,
  AlertTriangle,
  UserPlus,
  Eye,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "CRM — Clientes — Localix" }] }),
  component: CustomersPage,
});

type Customer360ListItem = {
  customer: {
    id: string;
    restaurant_id: string;
    name: string | null;
    phone: string;
    email: string | null;
    total_orders: number | null;
    total_spent: number | string | null;
    avg_ticket: number | string | null;
    last_order_at: string | null;
    created_at: string;
    updated_at: string;
  };
  lifecycle: Customer360Lifecycle;
  metrics: {
    total_orders: number;
    total_spent: number;
    avg_ticket: number;
    last_order_at: string | null;
    days_since_last_order: number | null;
  };
};

const LIFECYCLE_META: Record<
  Customer360Lifecycle,
  { label: string; tone: string }
> = {
  NEW: {
    label: "Novo",
    tone: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  },
  AWAITING_SECOND_PURCHASE: {
    label: "Aguardando 2ª compra",
    tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  RECURRING: {
    label: "Recorrente",
    tone: "bg-primary/10 text-primary border-primary/30",
  },
  HIGH_VALUE: {
    label: "Alto valor",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  LOYAL: {
    label: "Fiel",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  AT_RISK: {
    label: "Em risco",
    tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
  INACTIVE: {
    label: "Inativo",
    tone: "bg-muted text-muted-foreground border-border",
  },
  REACTIVATED: {
    label: "Reativado",
    tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
};

function CustomersPage() {
  const restaurant = useRestaurant();
  const listFn = useServerFn(listCustomer360);
  const detailFn = useServerFn(getCustomer360);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Customer360Lifecycle | "ALL">("ALL");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const {
    data: items = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<Customer360ListItem[]>({
    enabled: !!restaurant?.id,
    queryKey: ["customer360-list", restaurant?.id],
    queryFn: async () =>
      (await listFn({
        data: { restaurantId: restaurant.id, limit: 200 },
      })) as Customer360ListItem[],
    staleTime: 30_000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    enabled: !!restaurant?.id && !!selectedCustomerId,
    queryKey: ["customer360-detail", restaurant?.id, selectedCustomerId],
    queryFn: () =>
      detailFn({
        data: {
          restaurantId: restaurant.id,
          customerId: selectedCustomerId!,
        },
      }),
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: items.length };
    for (const item of items) {
      map[item.lifecycle] = (map[item.lifecycle] ?? 0) + 1;
    }
    return map;
  }, [items]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "ALL" && item.lifecycle !== filter) return false;
      if (!term) return true;
      const c = item.customer;
      return (
        (c.name ?? "").toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        (c.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, q, filter]);

  const summaryCards = [
    { key: "ALL" as const, label: "Clientes", value: counts.ALL ?? 0, icon: Users },
    {
      key: "AWAITING_SECOND_PURCHASE" as const,
      label: "Aguardando 2ª compra",
      value: counts.AWAITING_SECOND_PURCHASE ?? 0,
      icon: UserPlus,
    },
    {
      key: "RECURRING" as const,
      label: "Recorrentes",
      value: counts.RECURRING ?? 0,
      icon: Repeat,
    },
    {
      key: "AT_RISK" as const,
      label: "Em risco",
      value: counts.AT_RISK ?? 0,
      icon: AlertTriangle,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">CRM · Customer 360</h1>
          <p className="text-sm text-muted-foreground">
            Métricas e lifecycle calculados pelo servidor a partir de compras realizadas.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch().catch(() => toast.error("Falha ao atualizar clientes"))}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Atualizar
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(({ key, label, value, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`text-left ${filter === key ? "rounded-xl ring-2 ring-primary/40" : ""}`}
          >
            <Card className="p-4 transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
            </Card>
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
              Todos
            </FilterChip>
            {(Object.keys(LIFECYCLE_META) as Customer360Lifecycle[]).map((lifecycle) => (
              <FilterChip
                key={lifecycle}
                active={filter === lifecycle}
                onClick={() => setFilter(lifecycle)}
              >
                {LIFECYCLE_META[lifecycle].label} ({counts[lifecycle] ?? 0})
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2 pr-4">Total gasto</th>
                <th className="py-2 pr-4">Pedidos</th>
                <th className="py-2 pr-4">Ticket médio</th>
                <th className="py-2 pr-4">Última compra</th>
                <th className="py-2 pr-4">Lifecycle</th>
                <th className="py-2 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}

              {visible.map((item) => {
                const customer = item.customer;
                const lifecycle = LIFECYCLE_META[item.lifecycle];
                return (
                  <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{customer.name || "Cliente sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                    </td>
                    <td className="py-3 pr-4 font-semibold">{brl(item.metrics.total_spent)}</td>
                    <td className="py-3 pr-4">{item.metrics.total_orders}</td>
                    <td className="py-3 pr-4">{brl(item.metrics.avg_ticket)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {item.metrics.last_order_at
                        ? new Date(item.metrics.last_order_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className={lifecycle.tone}>
                        {lifecycle.label}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCustomerId(customer.id)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Ver 360
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={!!selectedCustomerId}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomerId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer 360</DialogTitle>
            <DialogDescription>
              Visão comportamental do cliente neste estabelecimento.
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Customer360Detail detail={detail as any} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Customer360Detail({ detail }: { detail: any }) {
  const lifecycle = LIFECYCLE_META[detail.lifecycle as Customer360Lifecycle];
  const metrics = detail.metrics;

  const weekday =
    metrics.predominant_weekday_utc == null
      ? "—"
      : ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][metrics.predominant_weekday_utc];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">{detail.customer.name || "Cliente sem nome"}</h3>
          <p className="text-sm text-muted-foreground">
            {detail.customer.phone}
            {detail.customer.email ? ` · ${detail.customer.email}` : ""}
          </p>
        </div>
        <Badge variant="outline" className={lifecycle.tone}>
          {lifecycle.label}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Pedidos realizados" value={String(metrics.total_orders)} />
        <Metric label="Total gasto" value={brl(metrics.total_spent)} />
        <Metric label="Ticket médio" value={brl(metrics.avg_ticket)} />
        <Metric
          label="Dias desde a última compra"
          value={metrics.days_since_last_order == null ? "—" : String(metrics.days_since_last_order)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <h4 className="font-semibold">Comportamento</h4>
          <dl className="mt-3 space-y-2 text-sm">
            <DetailRow
              label="Primeira compra"
              value={metrics.first_order_at ? new Date(metrics.first_order_at).toLocaleDateString("pt-BR") : "—"}
            />
            <DetailRow
              label="Última compra"
              value={metrics.last_order_at ? new Date(metrics.last_order_at).toLocaleDateString("pt-BR") : "—"}
            />
            <DetailRow
              label="Intervalo médio"
              value={metrics.avg_days_between_orders == null ? "—" : `${metrics.avg_days_between_orders} dias`}
            />
            <DetailRow label="Frequência / 30d" value={String(metrics.frequency_per_30d)} />
            <DetailRow label="Dia predominante (UTC)" value={weekday} />
            <DetailRow
              label="Hora predominante (UTC)"
              value={metrics.predominant_hour_utc == null ? "—" : `${String(metrics.predominant_hour_utc).padStart(2, "0")}:00`}
            />
          </dl>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold">Eventos e uso</h4>
          <dl className="mt-3 space-y-2 text-sm">
            <DetailRow label="Uso de cupom" value={String(metrics.coupon_usage_count)} />
            <DetailRow label="Cancelamentos" value={String(metrics.cancellations)} />
            <DetailRow label="Reembolsos" value={String(metrics.refunds)} />
            <DetailRow label="Chargebacks" value={String(metrics.chargebacks)} />
          </dl>
        </Card>
      </div>

      {Array.isArray(detail.intelligence) && detail.intelligence.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold">Oportunidades identificadas</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Sugestões baseadas no comportamento do Customer 360. Nenhuma ação é executada automaticamente.
          </p>
          <div className="mt-3 space-y-2">
            {detail.intelligence.map((insight: any) => (
              <div key={insight.type} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{insight.title}</p>
                  <Badge variant="outline">{insight.severity}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{insight.description}</p>
                <p className="mt-2 text-xs font-medium text-primary">
                  Ação sugerida: {String(insight.recommended_action).replaceAll("_", " ")}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h4 className="font-semibold">Produtos favoritos</h4>
        {metrics.favorite_products.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Ainda não há produtos suficientes para exibir.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {metrics.favorite_products.map((product: any, index: number) => (
              <div key={product.product_id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="mr-2 text-xs text-muted-foreground">#{index + 1}</span>
                  <span className="font-medium">{product.name || "Produto"}</span>
                </div>
                <span className="text-muted-foreground">{product.qty} un.</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
