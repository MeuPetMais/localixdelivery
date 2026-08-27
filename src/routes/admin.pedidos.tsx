import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Search,
} from "lucide-react";
import {
  getAdminOrderDetail,
  getAdminOrderRestaurants,
  getAdminOrders,
  type AdminOrderAlert,
  type AdminOrderDetail,
} from "@/lib/admin-orders.functions";
import { brl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({ meta: [{ title: "Admin - Pedidos" }] }),
  component: AdminOrdersPage,
});

const ORDER_STATUS_OPTIONS = [
  "novo",
  "aguardando_pagamento",
  "pago",
  "falha_pagamento",
  "aceito",
  "rejeitado",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
  "entregue",
  "concluido",
  "cancelado",
  "reembolsado",
  "chargeback",
];

const PAYMENT_METHOD_OPTIONS = [
  "pix",
  "credit_card",
  "debit_card",
  "cash",
  "card_on_delivery",
  "card_delivery",
  "meal_voucher",
];

const PAYMENT_STATUS_OPTIONS = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "REJECTED",
  "CANCELLED",
  "REFUNDED",
  "CHARGEBACK",
];

type Filters = {
  from: string;
  to: string;
  status: string;
  restaurantId: string;
  paymentMethod: string;
  paymentStatus: string;
  search: string;
  pageSize: number;
};

const initialFilters: Filters = {
  from: "",
  to: "",
  status: "all",
  restaurantId: "all",
  paymentMethod: "all",
  paymentStatus: "all",
  search: "",
  pageSize: 25,
};

function AdminOrdersPage() {
  const listOrders = useServerFn(getAdminOrders);
  const loadDetail = useServerFn(getAdminOrderDetail);
  const loadRestaurants = useServerFn(getAdminOrderRestaurants);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const queryPayload = useMemo(
    () => ({
      page,
      pageSize: filters.pageSize,
      from: filters.from || undefined,
      to: filters.to || undefined,
      status: filters.status === "all" ? undefined : filters.status,
      restaurantId: filters.restaurantId === "all" ? undefined : filters.restaurantId,
      paymentMethod: filters.paymentMethod === "all" ? undefined : filters.paymentMethod,
      paymentStatus: filters.paymentStatus === "all" ? undefined : filters.paymentStatus,
      search: filters.search.trim() || undefined,
    }),
    [filters, page],
  );

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", queryPayload],
    queryFn: () => listOrders({ data: queryPayload }),
    retry: false,
  });

  const restaurantsQuery = useQuery({
    queryKey: ["admin-order-restaurants"],
    queryFn: () => loadRestaurants(),
    retry: false,
  });

  const detailQuery = useQuery({
    enabled: detailOpen && !!selectedOrderId,
    queryKey: ["admin-order-detail", selectedOrderId],
    queryFn: () => loadDetail({ data: { orderId: selectedOrderId! } }),
    retry: false,
  });

  const total = ordersQuery.data?.total ?? 0;
  const pageSize = ordersQuery.data?.pageSize ?? filters.pageSize;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const recordsLabel = ordersQuery.isLoading
    ? "Carregando..."
    : ordersQuery.isError
      ? "Indisponivel"
      : `${total.toLocaleString("pt-BR")} registros`;

  function patchFilters(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function openDetail(orderId: string) {
    setSelectedOrderId(orderId);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Central de Pedidos</h1>
          <p className="text-sm text-slate-400">
            Acompanhe pedidos, pagamentos, entrega e historico operacional da plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          {recordsLabel}
        </div>
      </div>

      <section className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 md:grid-cols-2 xl:grid-cols-6">
        <Field label="Periodo inicial">
          <input
            type="date"
            value={filters.from}
            onChange={(event) => patchFilters({ from: event.target.value })}
            className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          />
        </Field>
        <Field label="Periodo final">
          <input
            type="date"
            value={filters.to}
            onChange={(event) => patchFilters({ to: event.target.value })}
            className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          />
        </Field>
        <Field label="Status">
          <FilterSelect value={filters.status} onValueChange={(status) => patchFilters({ status })}>
            <SelectItem value="all">Todos</SelectItem>
            {ORDER_STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabel(status)}
              </SelectItem>
            ))}
          </FilterSelect>
        </Field>
        <Field label="Parceiro">
          <FilterSelect
            value={filters.restaurantId}
            onValueChange={(restaurantId) => patchFilters({ restaurantId })}
          >
            <SelectItem value="all">Todos</SelectItem>
            {(restaurantsQuery.data ?? []).map((restaurant) => (
              <SelectItem key={restaurant.id} value={restaurant.id}>
                {restaurant.name ?? restaurant.id.slice(0, 8)}
              </SelectItem>
            ))}
          </FilterSelect>
        </Field>
        <Field label="Pagamento">
          <FilterSelect
            value={filters.paymentMethod}
            onValueChange={(paymentMethod) => patchFilters({ paymentMethod })}
          >
            <SelectItem value="all">Todos</SelectItem>
            {PAYMENT_METHOD_OPTIONS.map((method) => (
              <SelectItem key={method} value={method}>
                {paymentMethodLabel(method)}
              </SelectItem>
            ))}
          </FilterSelect>
        </Field>
        <Field label="Status pag.">
          <FilterSelect
            value={filters.paymentStatus}
            onValueChange={(paymentStatus) => patchFilters({ paymentStatus })}
          >
            <SelectItem value="all">Todos</SelectItem>
            {PAYMENT_STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </FilterSelect>
        </Field>
        <div className="md:col-span-2 xl:col-span-4">
          <Field label="Busca">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                value={filters.search}
                onChange={(event) => patchFilters({ search: event.target.value })}
                placeholder="Numero do pedido, cliente ou estabelecimento"
                className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100"
              />
            </div>
          </Field>
        </div>
        <Field label="Linhas">
          <FilterSelect
            value={String(filters.pageSize)}
            onValueChange={(value) => patchFilters({ pageSize: Number(value) })}
          >
            {[25, 50, 100].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </FilterSelect>
        </Field>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-800/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Pedido</th>
                <th className="px-4 py-3 text-left">Data/hora</th>
                <th className="px-4 py-3 text-left">Estabelecimento</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Pagamento</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Alertas</th>
                <th className="px-4 py-3 text-right">Ver detalhes</th>
              </tr>
            </thead>
            <tbody>
              {ordersQuery.isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Carregando pedidos...
                  </td>
                </tr>
              )}
              {ordersQuery.isError && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-red-300">
                    Nao foi possivel carregar os pedidos.
                  </td>
                </tr>
              )}
              {!ordersQuery.isLoading && !ordersQuery.isError && (ordersQuery.data?.rows ?? []).length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              )}
              {(ordersQuery.data?.rows ?? []).map((order) => (
                <tr key={order.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    {order.order_number ? `#${order.order_number}` : order.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{formatDateTime(order.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{order.restaurant.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      <div>{order.customer.name ?? "-"}</div>
                      <div className="text-xs text-slate-500">{order.customer.phoneMasked ?? "-"}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      <div className="text-slate-200">{paymentMethodLabel(order.payment_method)}</div>
                      <div className="text-xs text-slate-500">{order.payment_status ?? "Sem pagamento"}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {order.financialSnapshotAvailable && order.customer_total != null ? (
                      brl(order.customer_total)
                    ) : (
                      <span className="text-xs text-amber-300">Snapshot financeiro indisponivel</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <AlertSummary alerts={order.alerts} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetail(order.id)}
                      className="text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      <Eye className="h-4 w-4" />
                      Ver
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Pagina {page} de {maxPage}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= maxPage}
              onClick={() => setPage((current) => Math.min(maxPage, current + 1))}
              className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
            >
              Proxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto border-slate-800 bg-slate-950 text-slate-100 sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle className="text-slate-100">Detalhe do pedido</SheetTitle>
            <SheetDescription>
              Consulta administrativa read-only do pedido selecionado.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {detailQuery.isLoading && (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Carregando detalhe...
              </div>
            )}
            {detailQuery.isError && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
                Nao foi possivel carregar o detalhe do pedido.
              </div>
            )}
            {detailQuery.data && <OrderDetailContent detail={detailQuery.data} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs font-medium uppercase text-slate-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FilterSelect({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
        {children}
      </SelectContent>
    </Select>
  );
}

function OrderDetailContent({ detail }: { detail: AdminOrderDetail }) {
  return (
    <div className="space-y-5">
      <DetailSection title="Resumo">
        <InfoGrid
          rows={[
            ["Pedido", detail.order_number ? `#${detail.order_number}` : detail.id.slice(0, 8)],
            ["Criado em", formatDateTime(detail.created_at)],
            ["Status", statusLabel(detail.status)],
            ["Estabelecimento", detail.restaurant.name ?? "-"],
            ["Metodo de pagamento", paymentMethodLabel(detail.payment_method)],
          ]}
        />
      </DetailSection>

      <DetailSection title="Itens">
        {detail.items.length ? (
          <div className="space-y-2">
            {detail.items.map((item, index) => (
              <div key={index} className="rounded-md border border-slate-800 bg-slate-900 p-3 text-sm">
                <pre className="whitespace-pre-wrap break-words font-sans text-slate-200">
                  {formatItem(item)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <EmptyLine text="Sem itens registrados." />
        )}
      </DetailSection>

      <DetailSection title="Cliente e entrega">
        <InfoGrid
          rows={[
            ["Cliente", detail.customer.name ?? "-"],
            ["Telefone", detail.customer.phone ?? "-"],
            ["Endereco", detail.customer.address ?? "-"],
            ["Observacao", detail.customer.notes ?? "-"],
          ]}
        />
        <div className="mt-4">
          {detail.delivery ? (
            <InfoGrid
              rows={[
                ["Status da entrega", detail.delivery.status ?? "-"],
                ["Entregador", detail.delivery.driver?.name ?? "-"],
                ["Designado em", formatNullableDate(detail.delivery.assigned_at)],
                ["Coleta", formatNullableDate(detail.delivery.picked_up_at)],
                ["Saiu para entrega", formatNullableDate(detail.delivery.departed_at)],
                ["Entregue em", formatNullableDate(detail.delivery.delivered_at)],
                ["Distancia", detail.delivery.distance_km == null ? "-" : `${detail.delivery.distance_km} km`],
              ]}
            />
          ) : (
            <EmptyLine text="Sem entrega registrada." />
          )}
        </div>
      </DetailSection>

      <DetailSection title="Pagamento">
        {detail.payment ? (
          <InfoGrid
            rows={[
              ["Metodo", paymentMethodLabel(detail.payment.method)],
              ["Provider", detail.payment.provider ?? "-"],
              ["Status", detail.payment.status ?? "-"],
              ["Payment id interno", detail.payment.internal_payment_id ?? "-"],
              ["Referencia provider", detail.payment.provider_reference ?? "-"],
              ["Criado em", formatNullableDate(detail.payment.created_at)],
              ["Atualizado em", formatNullableDate(detail.payment.updated_at)],
              ["Pago em", formatNullableDate(detail.payment.paid_at)],
            ]}
          />
        ) : (
          <EmptyLine text="Sem pagamento registrado." />
        )}
      </DetailSection>

      <DetailSection title="Financeiro">
        {detail.financialSnapshotAvailable && detail.financial ? (
          <InfoGrid
            rows={[
              ["Subtotal", moneyLabel(detail.financial.subtotal)],
              ["Entrega", moneyLabel(detail.financial.delivery_fee)],
              ["Taxa plataforma", moneyLabel(detail.financial.platform_fee)],
              ["Pagador da taxa", detail.financial.service_fee_payer ?? "-"],
              ["Cupom", moneyLabel(detail.financial.coupon_discount)],
              ["Cashback", moneyLabel(detail.financial.cashback)],
              ["Loyalty discount", moneyLabel(detail.financial.loyalty_discount)],
              ["Total cliente", moneyLabel(detail.financial.customer_total)],
              ["Bruto restaurante", moneyLabel(detail.financial.restaurant_gross)],
              ["Liquido restaurante", moneyLabel(detail.financial.restaurant_net)],
              ["Receita plataforma", moneyLabel(detail.financial.platform_revenue)],
              ["Realized platform revenue", moneyLabel(detail.financial.realized_platform_revenue)],
              ["Gateway fee", moneyLabel(detail.financial.gateway_fee)],
              ["Provider", detail.financial.provider ?? "-"],
              ["Currency", detail.financial.currency ?? "-"],
            ]}
          />
        ) : (
          <EmptyLine text="Snapshot financeiro indisponivel" />
        )}
      </DetailSection>

      <DetailSection title="Timeline">
        {detail.timeline.length ? (
          <div className="space-y-3">
            {detail.timeline.map((entry) => (
              <div key={entry.id} className="rounded-md border border-slate-800 bg-slate-900 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-100">
                    {statusLabel(entry.previous_status)} {"->"} {statusLabel(entry.current_status)}
                  </div>
                  <div className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</div>
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {entry.actor_type ?? "system"} {entry.reason ? `- ${entry.reason}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyLine text="Sem historico registrado." />
        )}
      </DetailSection>

      <DetailSection title="Alertas">
        {detail.alerts.length ? <AlertList alerts={detail.alerts} /> : <EmptyLine text="Nenhum alerta comprovavel." />}
      </DetailSection>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase text-slate-300">{title}</h2>
      {children}
    </section>
  );
}

function InfoGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md border border-slate-800 bg-slate-900 p-3">
          <dt className="text-xs uppercase text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm text-slate-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
      {text}
    </div>
  );
}

function AlertSummary({ alerts }: { alerts: AdminOrderAlert[] }) {
  if (!alerts.length) return <span className="text-xs text-slate-500">Nenhum</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {alerts.slice(0, 2).map((alert) => (
        <Badge
          key={alert.code}
          variant="outline"
          className={alert.severity === "error" ? "border-red-500/40 text-red-300" : "border-amber-500/40 text-amber-300"}
        >
          <AlertTriangle className="mr-1 h-3 w-3" />
          {alert.label}
        </Badge>
      ))}
      {alerts.length > 2 && <span className="text-xs text-slate-500">+{alerts.length - 2}</span>}
    </div>
  );
}

function AlertList({ alerts }: { alerts: AdminOrderAlert[] }) {
  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.code}
          className={`rounded-md border p-3 text-sm ${
            alert.severity === "error"
              ? "border-red-900/70 bg-red-950/30 text-red-200"
              : "border-amber-900/70 bg-amber-950/30 text-amber-200"
          }`}
        >
          {alert.label}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className="border-slate-700 bg-slate-950 text-slate-200">
      {statusLabel(status)}
    </Badge>
  );
}

function statusLabel(status: string | null | undefined) {
  if (!status) return "-";
  return status.replace(/_/g, " ");
}

function paymentMethodLabel(method: string | null | undefined) {
  if (!method) return "-";
  const labels: Record<string, string> = {
    pix: "PIX",
    credit_card: "Cartao de credito",
    debit_card: "Cartao de debito",
    cash: "Dinheiro",
    card_on_delivery: "Cartao na entrega",
    card_delivery: "Cartao na entrega",
    meal_voucher: "Vale refeicao",
  };
  return labels[method] ?? method.replace(/_/g, " ");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatNullableDate(value: string | null | undefined) {
  return value ? formatDateTime(value) : "-";
}

function moneyLabel(value: number | null | undefined) {
  return value == null ? "-" : brl(value);
}

function formatItem(item: unknown) {
  if (!item || typeof item !== "object") return String(item ?? "-");
  const row = item as Record<string, unknown>;
  const qty = row.qty ?? row.quantity ?? 1;
  const name = row.name ?? row.title ?? "Item";
  return `${qty}x ${name}`;
}
