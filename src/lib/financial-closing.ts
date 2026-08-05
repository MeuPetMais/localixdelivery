// RC8.0 — Financeiro: helpers puros para fechamento de entregadores.
// Não altera Orders/Payments/Delivery/Tracking/Queue/Wallet — apenas agrega.

import { resolveDriverEarning, type DriverEarningSnapshot } from "./driver-earnings";

export type Period = "today" | "week" | "month" | "custom";

export type DeliveredRow = DriverEarningSnapshot & {
  driver_id: string | null;
  delivered_at: string | null;
  distance_km: number | null;
};

export type DriverEarnings = {
  driver_id: string;
  name: string;
  photo_url: string | null;
  pix_key: string | null;
  deliveries: number;
  distance_km: number;
  earnings: number;
};

export function earn(r: DeliveredRow): number {
  return resolveDriverEarning({
    ...r,
    driver_distance_km: r.driver_distance_km ?? r.distance_km,
  }).amount;
}

export function startOfLocalDay(offsetDays = 0, ref = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

export function periodBounds(
  period: Period,
  opts: { from?: string; to?: string; ref?: Date } = {},
): { from: Date; to: Date } {
  const ref = opts.ref ?? new Date();
  if (period === "today") {
    return { from: startOfLocalDay(0, ref), to: startOfLocalDay(1, ref) };
  }
  if (period === "week") {
    const start = startOfLocalDay(0, ref);
    const diff = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { from: start, to: end };
  }
  if (period === "month") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    return { from: start, to: end };
  }
  // custom
  const from = opts.from ? new Date(opts.from) : startOfLocalDay(0, ref);
  const to = opts.to ? new Date(opts.to) : startOfLocalDay(1, ref);
  return { from, to };
}

export function aggregateByDriver(
  rows: DeliveredRow[],
  drivers: { id: string; name: string; photo_url: string | null; pix_key?: string | null }[],
): DriverEarnings[] {
  const byId = new Map<string, DeliveredRow[]>();
  for (const r of rows) {
    if (!r.driver_id) continue;
    const arr = byId.get(r.driver_id) ?? [];
    arr.push(r);
    byId.set(r.driver_id, arr);
  }
  return drivers
    .map((d) => {
      const arr = byId.get(d.id) ?? [];
      const distance_km = arr.reduce((s, r) => s + (r.distance_km ?? 0), 0);
      const earnings = arr.reduce((s, r) => s + earn(r), 0);
      return {
        driver_id: d.id,
        name: d.name,
        photo_url: d.photo_url,
        pix_key: d.pix_key ?? null,
        deliveries: arr.length,
        distance_km,
        earnings,
      };
    })
    .sort((a, b) => b.earnings - a.earnings);
}

export function totals(list: DriverEarnings[]) {
  return list.reduce(
    (acc, d) => ({
      deliveries: acc.deliveries + d.deliveries,
      distance_km: acc.distance_km + d.distance_km,
      earnings: acc.earnings + d.earnings,
    }),
    { deliveries: 0, distance_km: 0, earnings: 0 },
  );
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function toCsv(list: DriverEarnings[]): string {
  const header = ["Entregador", "PIX", "Entregas", "KM", "Ganhos (R$)"];
  const rows = list.map((d) => [
    d.name,
    d.pix_key ?? "",
    String(d.deliveries),
    d.distance_km.toFixed(2),
    d.earnings.toFixed(2),
  ]);
  const t = totals(list);
  rows.push(["TOTAL", "", String(t.deliveries), t.distance_km.toFixed(2), t.earnings.toFixed(2)]);
  return [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}
