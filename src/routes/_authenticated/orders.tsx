import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/format";
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


type StatusKey = "novo" | "em_preparo" | "saiu_para_entrega" | "entregue" | "cancelado";

const COLUMNS: Array<{
  key: StatusKey;
  title: string;
  emoji: string;
  headerCls: string;
  accent: string;
  dropCls: string;
}> = [
  {
    key: "novo",
    title: "NOVOS",
    emoji: "🆕",
    headerCls: "bg-primary text-primary-foreground",
    accent: "border-l-4 border-primary",
    dropCls: "ring-2 ring-primary/60 bg-primary/5",
  },
  {
    key: "em_preparo",
    title: "EM PREPARO",
    emoji: "👨‍🍳",
    headerCls: "bg-amber-500 text-white",
    accent: "border-l-4 border-amber-500",
    dropCls: "ring-2 ring-amber-500/60 bg-amber-500/5",
  },
  {
    key: "saiu_para_entrega",
    title: "SAIU P/ ENTREGA",
    emoji: "🛵",
    headerCls: "bg-blue-600 text-white",
    accent: "border-l-4 border-blue-600",
    dropCls: "ring-2 ring-blue-500/60 bg-blue-500/5",
  },
  {
    key: "entregue",
    title: "ENTREGUES",
    emoji: "✅",
    headerCls: "bg-emerald-600 text-white",
    accent: "border-l-4 border-emerald-600",
    dropCls: "ring-2 ring-emerald-500/60 bg-emerald-500/5",
  },
  {
    key: "cancelado",
    title: "CANCELADOS",
    emoji: "❌",
    headerCls: "bg-destructive text-destructive-foreground",
    accent: "border-l-4 border-destructive",
    dropCls: "ring-2 ring-destructive/60 bg-destructive/5",
  },
];

const NEXT: Record<StatusKey, { key: StatusKey; label: string; icon: any } | null> = {
  novo: { key: "em_preparo", label: "Aceitar", icon: Check },
  em_preparo: { key: "saiu_para_entrega", label: "Saiu p/ entrega", icon: Bike },
  saiu_para_entrega: { key: "entregue", label: "Finalizar", icon: PackageCheck },
  entregue: null,
  cancelado: null,
};

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

const ACTIVE_STATUSES: StatusKey[] = ["novo", "em_preparo", "saiu_para_entrega"];

function minutesSince(iso: string, nowMs: number) {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
}

/** Urgency tone based on wait time (only meaningful for active orders). */
function urgencyTone(mins: number) {
  if (mins < 5) return { ring: "ring-emerald-500/40", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", label: "novo", pulse: "" };
  if (mins < 10) return { ring: "ring-amber-500/50", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400", label: "aguardando", pulse: "" };
  if (mins < 15) return { ring: "ring-orange-500/60", chip: "bg-orange-500/20 text-orange-700 dark:text-orange-400", label: "atenção", pulse: "" };
  return { ring: "ring-2 ring-destructive", chip: "bg-destructive text-destructive-foreground", label: "atrasado", pulse: "animate-pulse" };
}

type FilterKey =
  | "all" | "delivery" | "retirada" | "mesa"
  | "pix" | "cartao" | "dinheiro"
  | "urgentes" | "hoje" | "ontem";

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
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function OrdersPage() {
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState<StatusKey | null>(null);
  const draggingId = useRef<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Live timer — tick every 30s to refresh elapsed labels and urgency colors.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);


  const { data: orders, isLoading: loading } = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["orders", restaurant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) {
        toast.error("Falha ao carregar pedidos");
        throw error;
      }
      return (data ?? []) as unknown as Order[];
    },
  });

  async function updateStatus(id: string, status: StatusKey) {
    // optimistic
    const key = ["orders", restaurant.id];
    const prev = qc.getQueryData<Order[]>(key);
    if (prev) {
      qc.setQueryData<Order[]>(key, prev.map((o) => (o.id === id ? { ...o, status } : o)));
    }
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar");
      if (prev) qc.setQueryData(key, prev);
    } else {
      qc.invalidateQueries({ queryKey: key });
    }
  }

  const filtered = useMemo(() => {
    const list = orders ?? [];
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, "");
    return list.filter((o) => {
      // filter chip
      switch (filter) {
        case "delivery": if (!o.address) return false; break;
        case "retirada": if (o.address) return false; break;
        case "mesa": return false; // sem suporte de mesa no schema atual
        case "pix": if (!/pix/i.test(o.payment_method ?? "")) return false; break;
        case "cartao": if (!/cart|credit|debit/i.test(o.payment_method ?? "")) return false; break;
        case "dinheiro": if (!/dinheiro|cash|especie/i.test(o.payment_method ?? "")) return false; break;
        case "urgentes":
          if (!ACTIVE_STATUSES.includes(o.status as StatusKey)) return false;
          if (minutesSince(o.created_at, nowMs) < 10) return false;
          break;
        case "hoje": if (!isSameDay(o.created_at, today)) return false; break;
        case "ontem": if (!isSameDay(o.created_at, yest)) return false; break;
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
    const g: Record<StatusKey, Order[]> = {
      novo: [], em_preparo: [], saiu_para_entrega: [], entregue: [], cancelado: [],
    };
    for (const o of filtered) {
      if (g[o.status as StatusKey]) g[o.status as StatusKey].push(o);
    }
    return g;
  }, [filtered]);

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
            (s, o) => s + (new Date(o.updated_at ?? o.created_at).getTime() - new Date(o.created_at).getTime()) / 60000,
            0,
          ) / finished.length,
        )
      : 0;
    const overdue = (orders ?? []).filter(
      (o) => ACTIVE_STATUSES.includes(o.status as StatusKey) && minutesSince(o.created_at, nowMs) >= 15,
    ).length;
    return { count: list.length, revenue, avgTicket, avgMin, overdue };
  }, [orders, nowMs]);


  function onDragStart(e: React.DragEvent, orderId: string) {
    draggingId.current = orderId;
    e.dataTransfer.setData("text/plain", orderId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOverCol(e: React.DragEvent, col: StatusKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== col) setDragOver(col);
  }
  function onDropCol(e: React.DragEvent, col: StatusKey) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId.current;
    setDragOver(null);
    draggingId.current = null;
    if (!id) return;
    const current = (orders ?? []).find((o) => o.id === id);
    if (!current || current.status === col) return;
    updateStatus(id, col);
  }

  function printOrder(o: Order) {
    const items = Array.isArray(o.items) ? o.items : [];
    const itemsHtml = items
      .map(
        (it) =>
          `<tr><td>${it.qty}x</td><td>${escapeHtml(it.name)}</td><td style="text-align:right">${brl(Number(it.price) * it.qty)}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pedido #${o.order_number ?? ""}</title>
<style>
  @media print { @page { margin: 8mm; } }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-width: 320px; margin: 0 auto; padding: 8px; color:#000; }
  h1 { font-size: 18px; margin: 0 0 4px; text-align:center; }
  .muted { color:#333; font-size: 12px; }
  hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  table { width:100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 2px 0; vertical-align: top; }
  .total { font-size: 16px; font-weight: 700; text-align:right; }
</style></head><body>
<h1>${escapeHtml(restaurant.name ?? "Pedido")}</h1>
<div class="muted" style="text-align:center">Pedido #${o.order_number ?? "-"}</div>
<hr/>
<div><b>Cliente:</b> ${escapeHtml(o.customer_name)}</div>
${o.customer_phone ? `<div><b>Telefone:</b> ${escapeHtml(formatPhone(o.customer_phone))}</div>` : ""}
${o.address ? `<div><b>Endereço:</b> ${escapeHtml(o.address)}</div>` : ""}
${o.payment_method ? `<div><b>Pagamento:</b> ${escapeHtml(o.payment_method)}</div>` : ""}
<div><b>Horário:</b> ${new Date(o.created_at).toLocaleString("pt-BR")}</div>
<hr/>
<table>${itemsHtml}</table>
<hr/>
${o.notes ? `<div><b>Obs:</b> ${escapeHtml(o.notes)}</div><hr/>` : ""}
<div class="total">TOTAL: ${brl(Number(o.total))}</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script>
</body></html>`;
    const w = window.open("", "_blank", "width=380,height=640");
    if (!w) { toast.error("Habilite pop-ups para imprimir"); return; }
    w.document.write(html);
    w.document.close();
  }

  function whatsappOrder(o: Order) {
    const phone = normalizePhone(o.customer_phone);
    if (!phone) { toast.error("Cliente sem telefone"); return; }
    const num = phone.startsWith("55") ? phone : `55${phone}`;
    const msg =
      `Olá, ${o.customer_name.split(" ")[0]}! Sobre seu pedido #${o.order_number ?? ""} no ${restaurant.name}. `;
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
        <Badge variant="outline" className="gap-1.5">
          <CircleDot className="h-3 w-3 text-emerald-500 animate-pulse" /> Ao vivo
        </Badge>
      </div>

      {/* Resumo */}
      <div className="mb-4 grid grid-cols-2 gap-2 px-4 sm:grid-cols-3 lg:grid-cols-5 lg:px-8">
        <SummaryCard icon={<ShoppingBag className="h-4 w-4" />} label="Pedidos Hoje" value={String(summary.count)} tone="primary" />
        <SummaryCard icon={<DollarSign className="h-4 w-4" />} label="Receita" value={brl(summary.revenue)} tone="emerald" />
        <SummaryCard icon={<Receipt className="h-4 w-4" />} label="Ticket Médio" value={brl(summary.avgTicket)} tone="blue" />
        <SummaryCard icon={<TimerIcon className="h-4 w-4" />} label="Tempo Médio" value={`${summary.avgMin} min`} tone="amber" />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Em atraso" value={String(summary.overdue)} tone={summary.overdue > 0 ? "destructive" : "muted"} pulse={summary.overdue > 0} />
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


      <div className="overflow-x-auto px-4 pb-4 lg:px-8">
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
                <header className={`rounded-t-2xl px-4 py-3 ${col.headerCls}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{col.emoji}</span>
                      <h2 className="font-display text-sm font-extrabold tracking-wide">{col.title}</h2>
                    </div>
                    <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs font-bold">
                      {list.length}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs opacity-90">
                    <span>{list.length} {list.length === 1 ? "pedido" : "pedidos"}</span>
                    <span className="font-semibold">{brl(total)}</span>
                  </div>
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 240px)" }}>
                  {list.length === 0 && (
                    <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                      Nenhum pedido
                    </p>
                  )}
                  {list.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      accent={col.accent}
                      nowMs={nowMs}
                      isActiveStatus={ACTIVE_STATUSES.includes(col.key)}
                      onDragStart={(e) => onDragStart(e, o.id)}
                      onAdvance={NEXT[col.key] ? () => updateStatus(o.id, NEXT[col.key]!.key) : undefined}
                      advanceLabel={NEXT[col.key]?.label}
                      AdvanceIcon={NEXT[col.key]?.icon}
                      onCancel={o.status !== "entregue" && o.status !== "cancelado" ? () => updateStatus(o.id, "cancelado") : undefined}
                      onPrint={() => printOrder(o)}
                      onWhatsapp={() => whatsappOrder(o)}
                      isNew={col.key === "novo"}
                    />
                  ))}

                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order: o,
  accent,
  nowMs,
  isActiveStatus,
  onDragStart,
  onAdvance,
  advanceLabel,
  AdvanceIcon,
  onCancel,
  onPrint,
  onWhatsapp,
  isNew,
}: {
  order: Order;
  accent: string;
  nowMs: number;
  isActiveStatus: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onAdvance?: () => void;
  advanceLabel?: string;
  AdvanceIcon?: any;
  onCancel?: () => void;
  onPrint: () => void;
  onWhatsapp: () => void;
  isNew: boolean;
}) {
  const items = Array.isArray(o.items) ? o.items : [];
  const hasPhone = !!normalizePhone(o.customer_phone);
  const mins = minutesSince(o.created_at, nowMs);
  const tone = isActiveStatus ? urgencyTone(mins) : null;
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      className={`cursor-grab space-y-2 rounded-xl p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing ${accent} ${
        tone ? `ring-1 ${tone.ring} ${tone.pulse}` : ""
      } ${isNew && !tone?.pulse ? "ring-1 ring-primary/40" : ""}`}
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
            {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {tone && (
        <div className={`flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${tone.chip}`}>
          <span className="flex items-center gap-1">
            <TimerIcon className="h-3 w-3" /> {mins} min
          </span>
          <span>{tone.label}</span>
        </div>
      )}


      <div className="space-y-1 text-xs text-muted-foreground">
        {o.customer_phone && (
          <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /> {formatPhone(o.customer_phone)}</p>
        )}
        {o.address && (
          <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /> <span className="truncate">{o.address}</span></p>
        )}
        {o.payment_method && (
          <p className="flex items-center gap-1.5"><CreditCard className="h-3 w-3 shrink-0" /> {o.payment_method}</p>
        )}
      </div>

      <ul className="rounded-md bg-muted/60 p-2 text-xs">
        {items.map((it, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span className="truncate">{it.qty}x {it.name}</span>
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

      <div className="grid grid-cols-2 gap-1.5 pt-1">
        {onAdvance && (
          <Button size="sm" className="col-span-2 h-8 gap-1 text-xs" onClick={onAdvance}>
            {AdvanceIcon ? <AdvanceIcon className="h-3.5 w-3.5" /> : null}
            {isNew ? "Aceitar e iniciar" : advanceLabel}
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={onPrint}>
          <Printer className="h-3.5 w-3.5" /> Imprimir
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          disabled={!hasPhone}
          onClick={onWhatsapp}
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </Button>
        {onCancel && (
          <Button
            size="sm"
            variant="outline"
            className="col-span-2 h-8 gap-1 border-destructive/30 text-xs text-destructive hover:bg-destructive/5"
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" /> Cancelar
          </Button>
        )}
      </div>
    </Card>
  );
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
