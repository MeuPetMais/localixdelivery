// RC6.7 — Filtros e utilidades da Carteira do Entregador (client-side).

export type WalletRange = "today" | "week" | "month" | "custom";

export type HistoryItem = {
  id: string;
  status: string;
  delivered_at: string | null;
  created_at?: string | null;
  earnings: number;
  order?: { order_number?: number | null; customer_name?: string | null; address?: string | null } | null;
};

export type DailyPoint = { date: string; value: number; count: number };

function startOfLocalDay(offsetDays = 0, ref = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function startOfWeek(ref = new Date()): Date {
  const d = startOfLocalDay(0, ref);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(ref = new Date()): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), 1);
}

export function rangeBounds(
  range: WalletRange,
  custom?: { from?: string | null; to?: string | null },
  now = new Date(),
): { from: Date; to: Date } {
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  if (range === "today") return { from: startOfLocalDay(0, now), to };
  if (range === "week") return { from: startOfWeek(now), to };
  if (range === "month") return { from: startOfMonth(now), to };
  const from = custom?.from ? new Date(custom.from + "T00:00:00") : startOfLocalDay(-29, now);
  const t = custom?.to ? new Date(custom.to + "T23:59:59") : to;
  return { from, to: t };
}

export function filterHistory(items: HistoryItem[], range: WalletRange, custom?: { from?: string | null; to?: string | null }): HistoryItem[] {
  const { from, to } = rangeBounds(range, custom);
  return items.filter((h) => {
    const ts = h.delivered_at ?? h.created_at ?? null;
    if (!ts) return false;
    const d = new Date(ts);
    return d >= from && d <= to;
  });
}

export function summarize(items: HistoryItem[]): { total: number; count: number; ticket: number } {
  const delivered = items.filter((i) => i.status === "ENTREGUE");
  const total = delivered.reduce((s, i) => s + (i.earnings ?? 0), 0);
  return {
    total,
    count: delivered.length,
    ticket: delivered.length ? total / delivered.length : 0,
  };
}

export function toCsv(items: HistoryItem[]): string {
  const header = "data,pedido,cliente,status,valor";
  const rows = items.map((h) => {
    const date = (h.delivered_at ?? h.created_at ?? "").slice(0, 19).replace("T", " ");
    const num = h.order?.order_number ?? "";
    const cust = (h.order?.customer_name ?? "").replace(/"/g, '""');
    const val = (h.earnings ?? 0).toFixed(2).replace(".", ",");
    return `${date},${num},"${cust}",${h.status},${val}`;
  });
  return [header, ...rows].join("\n");
}

export function downloadCsv(name: string, content: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
