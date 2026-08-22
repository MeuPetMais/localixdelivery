import { paymentMethodLabel } from "@/lib/checkout/paymentMethodLabel";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { brl } from "@/lib/format";
import { cancelRestaurantOrder, transitionOrderStatus } from "@/lib/orders/orders.functions";

import {
  Loader2,
  Phone,
  MapPin,
  Clock,
  CircleDot,
  Printer,
  MessageCircle,
  X,
  Check,
  Bike,
  PackageCheck,
  StickyNote,
  CreditCard,
  Search,
  Flame,
  ShoppingBag,
  DollarSign,
  Receipt,
  Timer as TimerIcon,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { printOrder as printOrderSvc, type PrintableOrder } from "@/lib/print-service";

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
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
};

type DeliveryAssignmentSummary = {
  id: string;
  order_id: string;
  driver_id: string;
  status: string;
  assigned_at: string | null;
  driver_name: string | null;
};

// RC4.4 — Modelo Kanban baseado nos 14 estados oficiais do OrderStateMachine.
// Cada coluna representa uma etapa operacional e agrega um ou mais estados.
// Nenhuma transição foge do OrderOrchestrator (transitionOrderStatus).
type OrderStatus =
  | "novo"
  | "aguardando_pagamento"
  | "pago"
  | "falha_pagamento"
  | "aceito"
  | "rejeitado"
  | "em_preparo"
  | "pronto"
  | "saiu_para_entrega"
  | "entregue"
  | "concluido"
  | "cancelado"
  | "reembolsado"
  | "chargeback";

type ColumnKey =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "ready"
  | "delivering"
  | "delivered"
  | "cancelled";

const STATUS_TO_COLUMN: Record<OrderStatus, ColumnKey> = {
  novo: "pending_payment",
  aguardando_pagamento: "pending_payment",
  falha_pagamento: "pending_payment",
  pago: "paid",
  aceito: "preparing",
  em_preparo: "preparing",
  pronto: "ready",
  saiu_para_entrega: "delivering",
  entregue: "delivered",
  concluido: "delivered",
  cancelado: "cancelled",
  rejeitado: "cancelled",
  reembolsado: "cancelled",
  chargeback: "cancelled",
};

const COLUMNS: Array<{
  key: ColumnKey;
  title: string;
  short: string;
  emoji: string;
  headerCls: string;
  accent: string;
  dropCls: string;
  /** Estado canônico usado quando o usuário arrasta um card para esta coluna. */
  primaryState: OrderStatus;
}> = [
  {
    key: "pending_payment",
    title: "AGUARDANDO PAGAMENTO",
    short: "Aguardando",
    emoji: "⏳",
    headerCls: "bg-slate-600 text-white",
    accent: "border-l-4 border-slate-500",
    dropCls: "ring-2 ring-slate-500/60 bg-slate-500/5",
    primaryState: "aguardando_pagamento",
  },
  {
    key: "paid",
    title: "PAGOS / AGUARDANDO ACEITE",
    short: "Pagos",
    emoji: "💳",
    headerCls: "bg-primary text-primary-foreground",
    accent: "border-l-4 border-primary",
    dropCls: "ring-2 ring-primary/60 bg-primary/5",
    primaryState: "pago",
  },
  {
    key: "preparing",
    title: "EM PREPARO",
    short: "Preparo",
    emoji: "👨‍🍳",
    headerCls: "bg-amber-500 text-white",
    accent: "border-l-4 border-amber-500",
    dropCls: "ring-2 ring-amber-500/60 bg-amber-500/5",
    primaryState: "em_preparo",
  },
  {
    key: "ready",
    title: "PRONTOS",
    short: "Prontos",
    emoji: "📦",
    headerCls: "bg-indigo-600 text-white",
    accent: "border-l-4 border-indigo-500",
    dropCls: "ring-2 ring-indigo-500/60 bg-indigo-500/5",
    primaryState: "pronto",
  },
  {
    key: "delivering",
    title: "SAIU P/ ENTREGA",
    short: "Entrega",
    emoji: "🛵",
    headerCls: "bg-blue-600 text-white",
    accent: "border-l-4 border-blue-600",
    dropCls: "ring-2 ring-blue-500/60 bg-blue-500/5",
    primaryState: "saiu_para_entrega",
  },
  {
    key: "delivered",
    title: "ENTREGUES",
    short: "Entregues",
    emoji: "✅",
    headerCls: "bg-emerald-600 text-white",
    accent: "border-l-4 border-emerald-600",
    dropCls: "ring-2 ring-emerald-500/60 bg-emerald-500/5",
    primaryState: "entregue",
  },
  {
    key: "cancelled",
    title: "CANCELADOS",
    short: "Cancelados",
    emoji: "❌",
    headerCls: "bg-destructive text-destructive-foreground",
    accent: "border-l-4 border-destructive",
    dropCls: "ring-2 ring-destructive/60 bg-destructive/5",
    primaryState: "cancelado",
  },
];

// Botão "Avançar" por estado atual do pedido. Segue exatamente o
// ALLOWED_TRANSITIONS do OrderStateMachine — nenhum atalho.
const NEXT_BY_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: any }>> =
  {
    pago: { to: "aceito", label: "Aceitar", icon: Check },
    aceito: { to: "em_preparo", label: "Iniciar preparo", icon: Flame },
    em_preparo: { to: "pronto", label: "Marcar pronto", icon: PackageCheck },
    pronto: { to: "saiu_para_entrega", label: "Saiu p/ entrega", icon: Bike },
    saiu_para_entrega: { to: "entregue", label: "Finalizar", icon: PackageCheck },
    entregue: { to: "concluido", label: "Concluir", icon: Check },
  };

const TERMINAL_STATUSES: OrderStatus[] = [
  "concluido",
  "cancelado",
  "rejeitado",
  "reembolsado",
  "chargeback",
];
const ACTIVE_ASSIGNMENT_STATUSES = ["ATRIBUIDO", "COLETANDO", "EM_ROTA"];

function columnOf(order: Order): ColumnKey {
  const status = order.status as OrderStatus;

  if (status === "novo") {
    const method = (order.payment_method ?? "").toLowerCase().trim();

    if (method === "cash" || method === "dinheiro" || method === "especie") {
      return "paid";
    }
  }

  return STATUS_TO_COLUMN[status] ?? "pending_payment";
}

function normalizePhone(p?: string | null) {
  if (!p) return "";
  return p.replace(/\D+/g, "");
}

function formatPhone(p?: string | null) {
  const d = normalizePhone(p);
  if (!d) return "";
  const n = d.startsWith("55") ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return p ?? "";
}

const ACTIVE_STATUSES: OrderStatus[] = [
  "pago",
  "aceito",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
];
const ACTIVE_COLUMNS: ColumnKey[] = ["paid", "preparing", "ready", "delivering"];

function minutesSince(iso: string, nowMs: number) {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
}

function dispatchHref(orderId: string) {
  return `/entregas?order_id=${encodeURIComponent(orderId)}`;
}

/** Urgency tone based on wait time (only meaningful for active orders). */
function urgencyTone(mins: number) {
  if (mins < 5)
    return {
      ring: "ring-emerald-500/40",
      chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      label: "novo",
      pulse: "",
    };
  if (mins < 10)
    return {
      ring: "ring-amber-500/50",
      chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      label: "aguardando",
      pulse: "",
    };
  if (mins < 15)
    return {
      ring: "ring-orange-500/60",
      chip: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
      label: "atenção",
      pulse: "",
    };
  return {
    ring: "ring-2 ring-destructive",
    chip: "bg-destructive text-destructive-foreground",
    label: "atrasado",
    pulse: "animate-pulse",
  };
}

type FilterKey =
  | "all"
  | "delivery"
  | "retirada"
  | "mesa"
  | "pix"
  | "cartao"
  | "dinheiro"
  | "urgentes"
  | "hoje"
  | "ontem";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "delivery", label: "Delivery" },
  { key: "retirada", label: "Retirada" },
  { key: "mesa", label: "Mesa" },
  { key: "pix", label: "Pix" },
  { key: "cartao", label: "Cartão" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "urgentes", label: "Urgentes" },
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
];

function isSameDay(iso: string, ref: Date) {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function OrdersPage() {
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState<ColumnKey | null>(null);
  const draggingId = useRef<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [visibleCount, setVisibleCount] = useState(50);
  const [cancelingIds, setCancelingIds] = useState<Set<string>>(() => new Set());

  // Live timer — tick every 30s to refresh elapsed labels and urgency colors.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const {
    data: orders,
    isLoading: loading,
    isFetching,
  } = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["orders", restaurant?.id, visibleCount],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(visibleCount);
      if (error) {
        toast.error("Falha ao carregar pedidos");
        throw error;
      }
      return (data ?? []) as unknown as Order[];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: assignments } = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["orders-delivery-assignments", restaurant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_assignments")
        .select("id, order_id, driver_id, status, assigned_at, delivery_drivers(name)")
        .eq("restaurant_id", restaurant.id)
        .in("status", ACTIVE_ASSIGNMENT_STATUSES)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(
        (row: any): DeliveryAssignmentSummary => ({
          id: row.id,
          order_id: row.order_id,
          driver_id: row.driver_id,
          status: row.status,
          assigned_at: row.assigned_at,
          driver_name: row.delivery_drivers?.name ?? null,
        }),
      );
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const assignmentByOrderId = useMemo(() => {
    const map = new Map<string, DeliveryAssignmentSummary>();
    for (const assignment of assignments ?? []) {
      if (!map.has(assignment.order_id)) map.set(assignment.order_id, assignment);
    }
    return map;
  }, [assignments]);

  async function updateStatus(id: string, status: OrderStatus) {
    // Optimista — sem invalidateQueries (Realtime confirma via cache patch).
    const keyPrefix = ["orders", restaurant.id];
    const snapshots = qc.getQueriesData<Order[]>({ queryKey: keyPrefix });
    qc.setQueriesData<Order[]>({ queryKey: keyPrefix }, (prev) =>
      Array.isArray(prev) ? prev.map((o) => (o.id === id ? { ...o, status } : o)) : prev,
    );
    try {
      await transitionOrderStatus({ data: { orderId: id, to: status } });
      if (status === "pronto") {
        qc.invalidateQueries({ queryKey: ["orders-delivery-assignments", restaurant.id] });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const display = message.includes(":")
        ? message.split(":").slice(1).join(":")
        : "Nao foi possivel atualizar";
      toast.error(display || "Nao foi possivel atualizar");
      snapshots.forEach(([k, v]) => qc.setQueryData(k, v));
      console.error("[orders] transition failed", err);
    }
  }

  async function cancelOrder(order: Order) {
    if (cancelingIds.has(order.id)) return;
    setCancelingIds((prev) => new Set(prev).add(order.id));
    const keyPrefix = ["orders", restaurant.id];
    const snapshots = qc.getQueriesData<Order[]>({ queryKey: keyPrefix });
    try {
      const result = await cancelRestaurantOrder({ data: { orderId: order.id } });
      const nextStatus = result.status as OrderStatus;
      qc.setQueriesData<Order[]>({ queryKey: keyPrefix }, (prev) =>
        Array.isArray(prev)
          ? prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
          : prev,
      );
      toast.success(
        result.refunded
          ? `Pedido #${order.order_number ?? ""} reembolsado`
          : `Pedido #${order.order_number ?? ""} cancelado`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const display = message.includes(":")
        ? message.split(":").slice(1).join(":")
        : "Nao foi possivel cancelar";
      toast.error(display || "Nao foi possivel cancelar");
      snapshots.forEach(([k, v]) => qc.setQueryData(k, v));
      console.error("[orders] cancel failed", err);
    } finally {
      setCancelingIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  }

  const filtered = useMemo(() => {
    const list = orders ?? [];
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, "");
    return list.filter((o) => {
      // filter chip
      switch (filter) {
        case "delivery":
          if (!o.address) return false;
          break;
        case "retirada":
          if (o.address) return false;
          break;
        case "mesa":
          return false; // sem suporte de mesa no schema atual
        case "pix":
          if (!/pix/i.test(o.payment_method ?? "")) return false;
          break;
        case "cartao":
          if (!/cart|credit|debit/i.test(o.payment_method ?? "")) return false;
          break;
        case "dinheiro":
          if (!/dinheiro|cash|especie/i.test(o.payment_method ?? "")) return false;
          break;
        case "urgentes":
          if (!ACTIVE_STATUSES.includes(o.status as OrderStatus)) return false;
          if (minutesSince(o.created_at, nowMs) < 10) return false;
          break;
        case "hoje":
          if (!isSameDay(o.created_at, today)) return false;
          break;
        case "ontem":
          if (!isSameDay(o.created_at, yest)) return false;
          break;
      }
      // search
      if (q) {
        const inNumber = String(o.order_number ?? "").includes(qDigits || q);
        const inName = o.customer_name?.toLowerCase().includes(q);
        const inPhone = qDigits && normalizePhone(o.customer_phone).includes(qDigits);
        if (!inNumber && !inName && !inPhone) return false;
      }
      return true;
    });
  }, [orders, filter, search, nowMs]);

  const grouped = useMemo(() => {
    const g: Record<ColumnKey, Order[]> = {
      pending_payment: [],
      paid: [],
      preparing: [],
      ready: [],
      delivering: [],
      delivered: [],
      cancelled: [],
    };
    for (const o of filtered) {
      const col = columnOf(o);
      g[col].push(o);
    }
    const asc = (a: Order, b: Order) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    const desc = (a: Order, b: Order) => -asc(a, b);
    // Aguardando/pagos: mais recentes no topo (foco em novidade).
    g.pending_payment.sort(desc);
    g.paid.sort(desc);
    // Em preparo, prontos, saiu p/ entrega: FIFO — mais antigos primeiro.
    g.preparing.sort(asc);
    g.ready.sort(asc);
    g.delivering.sort(asc);
    // Entregues / cancelados: mais recentes no topo.
    g.delivered.sort(desc);
    g.cancelled.sort(desc);
    return g;
  }, [filtered]);

  // Rastreia pedidos vistos para animar apenas os novos que chegarem.
  const seenIds = useRef<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!orders) return;
    const incoming = new Set<string>();
    for (const o of orders) {
      if (!seenIds.current.has(o.id)) {
        incoming.add(o.id);
        seenIds.current.add(o.id);
      }
    }
    if (incoming.size && seenIds.current.size > incoming.size) {
      // Só marca como "fresh" se não é o primeiro carregamento.
      setFreshIds(incoming);
      const t = setTimeout(() => setFreshIds(new Set()), 2500);
      return () => clearTimeout(t);
    }
  }, [orders]);

  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [mobileTab, setMobileTab] = useState<ColumnKey>("paid");

  // Atalhos de teclado: A/P/S/F operam sobre o pedido aberto no drawer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      if (!detailOrder) return;
      // Atalhos avançam o pedido conforme sua situação atual — nunca pulam etapas.
      const next = NEXT_BY_STATUS[detailOrder.status as OrderStatus];
      const map: Record<string, OrderStatus | undefined> = {
        a: next?.to, // A = Avançar
        p: next?.to, // P = Próximo estado
        s: detailOrder.status === "pronto" ? "saiu_para_entrega" : next?.to,
        f: detailOrder.status === "saiu_para_entrega" ? "entregue" : next?.to,
      };
      const to = map[e.key.toLowerCase()];
      if (!to) return;
      e.preventDefault();
      if (detailOrder.address && (to === "saiu_para_entrega" || to === "entregue")) {
        window.location.href = dispatchHref(detailOrder.id);
        return;
      }
      updateStatus(detailOrder.id, to);
      setDetailOrder({ ...detailOrder, status: to });
      toast.success(`Pedido #${detailOrder.order_number ?? ""} → ${to.replace(/_/g, " ")}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailOrder]);

  // Summary (base: today's orders, ignoring active filters).
  const summary = useMemo(() => {
    const today = new Date();
    const list = (orders ?? []).filter((o) => isSameDay(o.created_at, today));
    const revenue = list
      .filter((o) => o.status !== "cancelado")
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const countValid = list.filter((o) => o.status !== "cancelado").length;
    const avgTicket = countValid > 0 ? revenue / countValid : 0;
    const finished = list.filter((o) => o.status === "entregue");
    const avgMin = finished.length
      ? Math.round(
          finished.reduce(
            (s, o) =>
              s +
              (new Date(o.updated_at ?? o.created_at).getTime() -
                new Date(o.created_at).getTime()) /
                60000,
            0,
          ) / finished.length,
        )
      : 0;
    const overdue = (orders ?? []).filter(
      (o) =>
        ACTIVE_STATUSES.includes(o.status as OrderStatus) &&
        minutesSince(o.created_at, nowMs) >= 15,
    ).length;
    return { count: list.length, revenue, avgTicket, avgMin, overdue };
  }, [orders, nowMs]);

  function onDragStart(e: React.DragEvent, orderId: string) {
    draggingId.current = orderId;
    e.dataTransfer.setData("text/plain", orderId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOverCol(e: React.DragEvent, col: ColumnKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== col) setDragOver(col);
  }
  function onDropCol(e: React.DragEvent, col: ColumnKey) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId.current;
    setDragOver(null);
    draggingId.current = null;
    if (!id) return;
    const current = (orders ?? []).find((o) => o.id === id);
    if (!current) return;
    if (columnOf(current) === col) return;
    // Estado canônico da coluna alvo — o Orchestrator/RPC valida a transição
    // e rejeita se não estiver em ALLOWED_TRANSITIONS.
    const target = COLUMNS.find((c) => c.key === col)?.primaryState;
    if (!target) return;
    updateStatus(id, target);
  }

  function printOrder(o: Order, template: "kitchen" | "customer" = "customer") {
    const items = Array.isArray(o.items) ? o.items : [];
    const printable: PrintableOrder = {
      order_number: o.order_number,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      address: o.address,
      items: items.map((it: any) => ({
        name: String(it.name ?? ""),
        qty: Number(it.qty ?? 1),
        price: Number(it.price ?? 0),
        notes: it.notes ?? null,
        options: Array.isArray(it.options) ? it.options : null,
        removed: Array.isArray(it.removed) ? it.removed : null,
      })),
      notes: o.notes ?? null,
      payment_method: o.payment_method,
      total: Number(o.total),
      created_at: o.created_at,
      restaurant_name: restaurant.name ?? null,
      order_type: o.address ? "delivery" : "pickup",
    };
    printOrderSvc(printable, { template }).catch(() => {
      toast.error("Não foi possível imprimir");
    });
  }

  function whatsappOrder(o: Order) {
    const phone = normalizePhone(o.customer_phone);
    if (!phone) {
      toast.error("Cliente sem telefone");
      return;
    }
    const num = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = `Olá, ${o.customer_name.split(" ")[0]}! Sobre seu pedido #${o.order_number ?? ""} no ${restaurant.name}. `;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="-mx-4 lg:-mx-8">
      <div className="mb-4 flex items-center justify-between gap-4 px-4 lg:px-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold lg:text-3xl">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Arraste os cards entre as colunas para atualizar o status.
          </p>
        </div>
        <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex">
          <span className="text-[10px] text-muted-foreground">Atalhos:</span>
          <kbd className="rounded bg-muted px-1 text-[10px]">A</kbd>
          <kbd className="rounded bg-muted px-1 text-[10px]">P</kbd>
          <kbd className="rounded bg-muted px-1 text-[10px]">S</kbd>
          <kbd className="rounded bg-muted px-1 text-[10px]">F</kbd>
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          <CircleDot className="h-3 w-3 text-emerald-500 animate-pulse" /> Ao vivo
        </Badge>
      </div>

      {/* Resumo */}
      <div className="mb-4 grid grid-cols-2 gap-2 px-4 sm:grid-cols-3 lg:grid-cols-5 lg:px-8">
        <SummaryCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Pedidos Hoje"
          value={String(summary.count)}
          tone="primary"
        />
        <SummaryCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Receita"
          value={brl(summary.revenue)}
          tone="emerald"
        />
        <SummaryCard
          icon={<Receipt className="h-4 w-4" />}
          label="Ticket Médio"
          value={brl(summary.avgTicket)}
          tone="blue"
        />
        <SummaryCard
          icon={<TimerIcon className="h-4 w-4" />}
          label="Tempo Médio"
          value={`${summary.avgMin} min`}
          tone="amber"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Em atraso"
          value={String(summary.overdue)}
          tone={summary.overdue > 0 ? "destructive" : "muted"}
          pulse={summary.overdue > 0}
        />
      </div>

      {/* Busca + Filtros */}
      <div className="mb-4 space-y-3 px-4 lg:px-8">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente ou telefone…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const isUrgent = f.key === "urgentes";
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? isUrgent
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {isUrgent && <Flame className="mr-1 inline h-3 w-3" />}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop / Tablet: Kanban horizontal */}
      <div className="hidden overflow-x-auto px-4 pb-4 md:block lg:px-8">
        <div className="flex min-w-max gap-4">
          {COLUMNS.map((col) => {
            const list = grouped[col.key];
            const total = list.reduce((s, o) => s + Number(o.total || 0), 0);
            const isOver = dragOver === col.key;
            return (
              <section
                key={col.key}
                onDragOver={(e) => onDragOverCol(e, col.key)}
                onDragLeave={() => setDragOver((c) => (c === col.key ? null : c))}
                onDrop={(e) => onDropCol(e, col.key)}
                className={`flex w-[360px] shrink-0 flex-col rounded-2xl border bg-muted/30 transition ${isOver ? col.dropCls : ""}`}
              >
                <ColumnHeader col={col} count={list.length} total={total} />
                <div
                  className="flex-1 space-y-3 overflow-y-auto p-3"
                  style={{ maxHeight: "calc(100vh - 240px)" }}
                >
                  {list.length === 0 && (
                    <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                      Nenhum pedido
                    </p>
                  )}
                  {list.map((o) => {
                    const next = NEXT_BY_STATUS[o.status as OrderStatus];
                    const canCancel = !TERMINAL_STATUSES.includes(o.status as OrderStatus);
                    const shouldUseDeliveryCenter =
                      !!o.address && (o.status === "pronto" || o.status === "saiu_para_entrega");
                    return (
                      <OrderCard
                        key={o.id}
                        order={o}
                        assignment={assignmentByOrderId.get(o.id) ?? null}
                        accent={col.accent}
                        nowMs={nowMs}
                        isActiveStatus={ACTIVE_COLUMNS.includes(col.key)}
                        onDragStart={(e) => onDragStart(e, o.id)}
                        onAdvance={
                          next && !shouldUseDeliveryCenter
                            ? () => updateStatus(o.id, next.to)
                            : undefined
                        }
                        advanceLabel={shouldUseDeliveryCenter ? undefined : next?.label}
                        AdvanceIcon={shouldUseDeliveryCenter ? undefined : next?.icon}
                        onCancel={canCancel ? () => cancelOrder(o) : undefined}
                        isCancelling={cancelingIds.has(o.id)}
                        onPrint={() => printOrder(o)}
                        onWhatsapp={() => whatsappOrder(o)}
                        isNew={col.key === "paid"}
                        isFresh={freshIds.has(o.id)}
                        onOpen={() => setDetailOrder(o)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Mobile: abas */}
      <div className="px-4 pb-4 md:hidden">
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as ColumnKey)}>
          <TabsList className="grid w-full grid-cols-6">
            {COLUMNS.filter((c) => c.key !== "cancelled").map((c) => (
              <TabsTrigger key={c.key} value={c.key} className="relative text-[10px]">
                {c.short}
                {grouped[c.key].length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                    {grouped[c.key].length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {COLUMNS.filter((c) => c.key !== "cancelled").map((col) => {
            const list = grouped[col.key];
            return (
              <TabsContent key={col.key} value={col.key} className="mt-3 space-y-3">
                {list.length === 0 && (
                  <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Nenhum pedido
                  </p>
                )}
                {list.map((o) => {
                  const next = NEXT_BY_STATUS[o.status as OrderStatus];
                  const canCancel = !TERMINAL_STATUSES.includes(o.status as OrderStatus);
                  const shouldUseDeliveryCenter =
                    !!o.address && (o.status === "pronto" || o.status === "saiu_para_entrega");
                  return (
                    <OrderCard
                      key={o.id}
                      order={o}
                      assignment={assignmentByOrderId.get(o.id) ?? null}
                      accent={col.accent}
                      nowMs={nowMs}
                      isActiveStatus={ACTIVE_COLUMNS.includes(col.key)}
                      onDragStart={() => {}}
                      onAdvance={
                        next && !shouldUseDeliveryCenter
                          ? () => updateStatus(o.id, next.to)
                          : undefined
                      }
                      advanceLabel={shouldUseDeliveryCenter ? undefined : next?.label}
                      AdvanceIcon={shouldUseDeliveryCenter ? undefined : next?.icon}
                      onCancel={canCancel ? () => cancelOrder(o) : undefined}
                      isCancelling={cancelingIds.has(o.id)}
                      onPrint={() => printOrder(o)}
                      onWhatsapp={() => whatsappOrder(o)}
                      isNew={col.key === "paid"}
                      isFresh={freshIds.has(o.id)}
                      onOpen={() => setDetailOrder(o)}
                    />
                  );
                })}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Scroll infinito / paginação */}
      {(orders?.length ?? 0) >= visibleCount && (
        <div className="flex justify-center px-4 pb-6 lg:px-8">
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => setVisibleCount((n) => n + 50)}
          >
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Carregar mais pedidos
          </Button>
        </div>
      )}

      <OrderDetailsDrawer
        order={detailOrder}
        onOpenChange={(open) => !open && setDetailOrder(null)}
        onPrint={detailOrder ? () => printOrder(detailOrder, "customer") : () => {}}
        onPrintKitchen={detailOrder ? () => printOrder(detailOrder, "kitchen") : () => {}}
        onWhatsapp={detailOrder ? () => whatsappOrder(detailOrder) : () => {}}
      />
    </div>
  );
}

function OrderCard({
  order: o,
  assignment,
  accent,
  nowMs,
  isActiveStatus,
  onDragStart,
  onAdvance,
  advanceLabel,
  AdvanceIcon,
  onCancel,
  isCancelling = false,
  onPrint,
  onWhatsapp,
  isNew,
  isFresh,
  onOpen,
}: {
  order: Order;
  assignment: DeliveryAssignmentSummary | null;
  accent: string;
  nowMs: number;
  isActiveStatus: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onAdvance?: () => void;
  advanceLabel?: string;
  AdvanceIcon?: any;
  onCancel?: () => void;
  isCancelling?: boolean;
  onPrint: () => void;
  onWhatsapp: () => void;
  isNew: boolean;
  isFresh?: boolean;
  onOpen: () => void;
}) {
  const items = Array.isArray(o.items) ? o.items : [];
  const hasPhone = !!normalizePhone(o.customer_phone);
  const mins = minutesSince(o.created_at, nowMs);
  const tone = isActiveStatus ? urgencyTone(mins) : null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const isDelivery = !!o.address;
  const needsDispatch = isDelivery && o.status === "pronto" && !assignment;
  const hasDeliveryFlowAction =
    isDelivery && (o.status === "pronto" || o.status === "saiu_para_entrega");
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      className={`cursor-pointer space-y-2 rounded-xl p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing ${accent} ${
        tone ? `ring-1 ${tone.ring} ${tone.pulse}` : ""
      } ${isNew && !tone?.pulse ? "ring-1 ring-primary/40" : ""} ${
        isFresh ? "animate-fade-in ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg font-extrabold leading-none">
            #{o.order_number ?? "—"}
          </p>
          <p className="mt-1 truncate text-sm font-semibold">{o.customer_name}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-extrabold text-primary">{brl(Number(o.total))}</p>
          <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(o.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {tone && (
        <div
          className={`flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${tone.chip}`}
        >
          <span className="flex items-center gap-1">
            <TimerIcon className="h-3 w-3" /> {mins} min
          </span>
          <span>{tone.label}</span>
        </div>
      )}

      <div className="space-y-1 text-xs text-muted-foreground">
        {o.customer_phone && (
          <p className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 shrink-0" /> {formatPhone(o.customer_phone)}
          </p>
        )}
        {o.address && (
          <p className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />{" "}
            <span className="truncate">{o.address}</span>
          </p>
        )}
        {o.payment_method && (
          <p className="flex items-center gap-1.5">
            <CreditCard className="h-3 w-3 shrink-0" /> {paymentMethodLabel(o.payment_method)}
          </p>
        )}
      </div>

      {isDelivery && o.status === "pronto" && (
        <div
          className={`rounded-md border p-2 text-xs ${needsDispatch ? "border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" : "bg-muted/50"}`}
        >
          {assignment ? (
            <div className="space-y-1">
              <p className="font-semibold">Motoboy: {assignment.driver_name ?? "Designado"}</p>
              <p className="text-muted-foreground">Entrega: {assignment.status}</p>
            </div>
          ) : (
            <p className="font-semibold">Motoboy ainda não designado</p>
          )}
        </div>
      )}

      <ul className="rounded-md bg-muted/60 p-2 text-xs">
        {items.map((it, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span className="truncate">
              {it.qty}x {it.name}
            </span>
            <span className="shrink-0 tabular-nums">{brl(Number(it.price) * it.qty)}</span>
          </li>
        ))}
      </ul>

      {o.notes && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="whitespace-pre-wrap">{o.notes}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 pt-1" onClick={stop}>
        {hasDeliveryFlowAction && (
          <Button asChild size="sm" className="col-span-2 h-8 gap-1 text-xs">
            <a href={dispatchHref(o.id)} onClick={stop}>
              <Bike className="h-3.5 w-3.5" />
              {needsDispatch ? "Despachar entrega" : "Acompanhar entrega"}
            </a>
          </Button>
        )}
        {onAdvance && (
          <Button
            size="sm"
            className="col-span-2 h-8 gap-1 text-xs"
            onClick={(e) => {
              stop(e);
              onAdvance();
            }}
          >
            {AdvanceIcon ? <AdvanceIcon className="h-3.5 w-3.5" /> : null}
            {advanceLabel}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          onClick={(e) => {
            stop(e);
            onPrint();
          }}
        >
          <Printer className="h-3.5 w-3.5" /> Imprimir
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          disabled={!hasPhone}
          onClick={(e) => {
            stop(e);
            onWhatsapp();
          }}
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </Button>
        {onCancel && (
          <Button
            size="sm"
            variant="outline"
            className="col-span-2 h-8 gap-1 border-destructive/30 text-xs text-destructive hover:bg-destructive/5"
            disabled={isCancelling}
            onClick={(e) => {
              stop(e);
              onCancel();
            }}
          >
            {isCancelling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            Cancelar
          </Button>
        )}
      </div>
    </Card>
  );
}

function OrderDetailsDrawer({
  order,
  onOpenChange,
  onPrint,
  onPrintKitchen,
  onWhatsapp,
}: {
  order: Order | null;
  onOpenChange: (open: boolean) => void;
  onPrint: () => void;
  onPrintKitchen: () => void;
  onWhatsapp: () => void;
}) {
  const items = order && Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  return (
    <Sheet open={!!order} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {order && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="font-display text-2xl">
                Pedido #{order.order_number ?? "—"}
              </SheetTitle>
              <SheetDescription>
                {new Date(order.created_at).toLocaleString("pt-BR")} · {order.status}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4 text-sm">
              <section className="rounded-lg border p-3">
                <h3 className="mb-2 text-xs font-bold uppercase text-muted-foreground">Cliente</h3>
                <p className="font-semibold">{order.customer_name}</p>
                {order.customer_phone && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {formatPhone(order.customer_phone)}
                  </p>
                )}
                {order.address && (
                  <p className="mt-1 flex items-start gap-1.5 text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{order.address}</span>
                  </p>
                )}
              </section>

              {order.payment_method && (
                <section className="rounded-lg border p-3">
                  <h3 className="mb-1 text-xs font-bold uppercase text-muted-foreground">
                    Pagamento
                  </h3>
                  <p className="flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4" /> {paymentMethodLabel(order.payment_method)}
                  </p>
                </section>
              )}

              <section className="rounded-lg border p-3">
                <h3 className="mb-2 text-xs font-bold uppercase text-muted-foreground">Itens</h3>
                <ul className="space-y-2">
                  {items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {it.qty}x {it.name}
                        </p>
                      </div>
                      <p className="shrink-0 tabular-nums">
                        {brl(Number(it.price) * Number(it.qty))}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 border-t pt-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{brl(subtotal)}</span>
                  </div>
                  <div className="mt-1 flex justify-between font-display text-lg font-extrabold">
                    <span>Total</span>
                    <span className="tabular-nums text-primary">{brl(Number(order.total))}</span>
                  </div>
                </div>
              </section>

              {order.notes && (
                <section className="rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase">
                    <StickyNote className="h-3.5 w-3.5" /> Observações
                  </h3>
                  <p className="whitespace-pre-wrap">{order.notes}</p>
                </section>
              )}

              <section className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Atualizado em{" "}
                {new Date(order.updated_at ?? order.created_at).toLocaleString("pt-BR")}
              </section>

              <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
                <Button variant="outline" className="gap-1.5" onClick={onPrintKitchen}>
                  <Printer className="h-4 w-4" /> Cozinha
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={onPrint}>
                  <Printer className="h-4 w-4" /> Cupom
                </Button>
                <Button
                  variant="outline"
                  className="col-span-2 gap-1.5 sm:col-span-1"
                  onClick={onWhatsapp}
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ColumnHeader({
  col,
  count,
  total,
}: {
  col: (typeof COLUMNS)[number];
  count: number;
  total: number;
}) {
  return (
    <header className={`rounded-t-2xl px-4 py-3 ${col.headerCls}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{col.emoji}</span>
          <h2 className="font-display text-sm font-extrabold tracking-wide">{col.title}</h2>
        </div>
        <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs font-bold">{count}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs opacity-90">
        <span>
          {count} {count === 1 ? "pedido" : "pedidos"}
        </span>
        <span className="font-semibold">{brl(total)}</span>
      </div>
    </header>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone = "primary",
  pulse = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "primary" | "emerald" | "blue" | "amber" | "destructive" | "muted";
  pulse?: boolean;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/10 text-blue-600",
    amber: "bg-amber-500/10 text-amber-600",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className={`rounded-2xl border-0 p-3 shadow-sm ${pulse ? "animate-pulse" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="font-display text-lg font-extrabold leading-tight">{value}</p>
        </div>
      </div>
    </Card>
  );
}
