// RC5.2.e — Driver Wallet
// Server functions expostas ao próprio motoboy autenticado.
// NUNCA aceitam driverId externo: derivam sempre de owner_id = context.userId.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DELIVERY_FEE_BRL = 8; // ganho por entrega (provisório — RC5.3 lê da política)
const DELIVERY_KM_BONUS = 1.5;

function startOfLocalDay(offsetDays = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}
function startOfWeek(): Date {
  const d = startOfLocalDay();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}
function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(): Date {
  return new Date(new Date().getFullYear(), 0, 1);
}

type Row = {
  id: string;
  distance_km: number | null;
  delivered_at: string | null;
  departed_at?: string | null;
  picked_up_at?: string | null;
  assigned_at?: string | null;
  created_at?: string;
  driver_id?: string | null;
  order_id?: string | null;
  status?: string;
};

function earn(r: Row): number {
  return DELIVERY_FEE_BRL + DELIVERY_KM_BONUS * (r.distance_km ?? 0);
}
function sumEarn(rows: Row[]): number {
  return rows.reduce((s, r) => s + earn(r), 0);
}
function sumKm(rows: Row[]): number {
  return rows.reduce((s, r) => s + (r.distance_km ?? 0), 0);
}
function avgMinutes(rows: Row[], from: keyof Row, to: keyof Row): number {
  const diffs: number[] = [];
  for (const r of rows) {
    const a = r[from] as string | null | undefined;
    const b = r[to] as string | null | undefined;
    if (a && b) {
      const ms = new Date(b).getTime() - new Date(a).getTime();
      if (ms > 0) diffs.push(ms / 60000);
    }
  }
  if (!diffs.length) return 0;
  return diffs.reduce((s, x) => s + x, 0) / diffs.length;
}

function bucketize(
  rows: Row[],
  bucket: (d: Date) => string,
): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const ts = r.delivered_at ?? r.created_at ?? null;
    if (!ts) continue;
    const key = bucket(new Date(ts));
    const arr = m.get(key) ?? [];
    arr.push(r);
    m.set(key, arr);
  }
  return m;
}

export const getDriverDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: driver } = await supabase
      .from("delivery_drivers")
      .select("*")
      .eq("owner_id", userId)
      .maybeSingle();

    if (!driver) return null;

    const dayStart = startOfLocalDay().toISOString();
    const yesterdayStart = startOfLocalDay(-1).toISOString();
    const weekStart = startOfWeek().toISOString();
    const monthStart = startOfMonth().toISOString();
    const yearStart = startOfYear().toISOString();

    // Entrega ativa
    const { data: activeRows } = await supabase
      .from("delivery_assignments")
      .select("*")
      .eq("driver_id", driver.id)
      .in("status", ["PENDENTE", "ATRIBUIDO", "COLETANDO", "EM_ROTA"])
      .order("created_at", { ascending: false })
      .limit(1);
    const active = activeRows?.[0] ?? null;

    let activeOrder: any = null;
    if (active) {
      const { data: ord } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone, address, total")
        .eq("id", active.order_id)
        .maybeSingle();
      activeOrder = ord ?? null;
    }

    // Todos os entregues do ano (base do dashboard)
    const { data: yearRows } = await supabase
      .from("delivery_assignments")
      .select("id, status, delivered_at, departed_at, picked_up_at, assigned_at, distance_km, order_id, created_at")
      .eq("driver_id", driver.id)
      .eq("status", "ENTREGUE")
      .gte("delivered_at", yearStart)
      .order("delivered_at", { ascending: false });

    const year: Row[] = (yearRows ?? []) as Row[];
    const today = year.filter((r) => r.delivered_at! >= dayStart);
    const yesterday = year.filter((r) => r.delivered_at! >= yesterdayStart && r.delivered_at! < dayStart);
    const week = year.filter((r) => r.delivered_at! >= weekStart);
    const month = year.filter((r) => r.delivered_at! >= monthStart);

    // Buckets: dia/semana/mês
    const byDay = bucketize(year, (d) => d.toISOString().slice(0, 10));
    const byWeek = bucketize(year, (d) => {
      const w = new Date(d); w.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      w.setHours(0, 0, 0, 0);
      return w.toISOString().slice(0, 10);
    });
    const byMonth = bucketize(year, (d) => `${d.getFullYear()}-${d.getMonth()}`);

    const pickMax = (m: Map<string, Row[]>) => {
      let best = { key: "", value: 0, count: 0 };
      for (const [k, arr] of m) {
        const v = sumEarn(arr);
        if (v > best.value) best = { key: k, value: v, count: arr.length };
      }
      return best;
    };

    // Histórico completo (30)
    const { data: history } = await supabase
      .from("delivery_assignments")
      .select("id, status, delivered_at, distance_km, order_id, created_at")
      .eq("driver_id", driver.id)
      .in("status", ["ENTREGUE", "CANCELADO"])
      .order("created_at", { ascending: false })
      .limit(30);

    // Ordens do histórico p/ mostrar número/cliente/bairro
    const orderIds = (history ?? []).map((h) => h.order_id).filter(Boolean) as string[];
    const activeOrderIds = orderIds.length > 0 ? orderIds : ["00000000-0000-0000-0000-000000000000"];
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, address")
      .in("id", activeOrderIds);
    const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));

    // Fila
    const { data: queueRows } = await supabase
      .from("delivery_queue")
      .select("driver_id, position, status, entered_at")
      .eq("restaurant_id", driver.restaurant_id)
      .eq("status", "AGUARDANDO")
      .order("position", { ascending: true });

    const myEntry = queueRows?.find((q) => q.driver_id === driver.id);
    const queueLength = queueRows?.length ?? 0;
    const myPosition = myEntry?.position ?? null;
    const waitingSince = myEntry?.entered_at ?? null;

    // Status fila derivado
    let queueStatus: "AGUARDANDO" | "EM_ENTREGA" | "RETORNANDO" | "OFFLINE" = "OFFLINE";
    if (active && (active.status === "COLETANDO" || active.status === "EM_ROTA" || active.status === "ATRIBUIDO")) {
      queueStatus = "EM_ENTREGA";
    } else if (myEntry) {
      queueStatus = "AGUARDANDO";
    } else if (driver.online) {
      queueStatus = "RETORNANDO";
    }

    // Ranking do restaurante — todos os motoboys, hoje
    const { data: allToday } = await supabase
      .from("delivery_assignments")
      .select("driver_id, distance_km, delivered_at, picked_up_at, departed_at, assigned_at, id, status")
      .eq("restaurant_id", driver.restaurant_id)
      .eq("status", "ENTREGUE")
      .gte("delivered_at", dayStart);
    const { data: driversList } = await supabase
      .from("delivery_drivers")
      .select("id, name, photo_url")
      .eq("restaurant_id", driver.restaurant_id);

    const byDriver = new Map<string, Row[]>();
    for (const r of (allToday ?? []) as Row[]) {
      if (!r.driver_id) continue;
      const arr = byDriver.get(r.driver_id) ?? [];
      arr.push(r);
      byDriver.set(r.driver_id, arr);
    }
    const ranking = (driversList ?? [])
      .map((d) => {
        const rows = byDriver.get(d.id) ?? [];
        return {
          id: d.id,
          name: d.name,
          photo_url: d.photo_url,
          earnings: sumEarn(rows),
          deliveries: rows.length,
          avgMinutes: avgMinutes(rows, "assigned_at", "delivered_at"),
        };
      })
      .sort((a, b) => b.earnings - a.earnings);
    const myRankIndex = ranking.findIndex((r) => r.id === driver.id);
    const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;

    // Streak: dias seguidos batendo meta (usa meta padrão 15 no server; cliente pode recomputar)
    const defaultGoal = 15;
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const day = startOfLocalDay(-i);
      const key = day.toISOString().slice(0, 10);
      const arr = byDay.get(key) ?? [];
      if (arr.length >= defaultGoal) streak++;
      else if (i === 0) continue; // hoje ainda em curso
      else break;
    }

    // Achievements — regras determinísticas server-side
    const lifetimeCount = year.length; // aproximação: entregas no ano
    const achievements = [
      { id: "first", label: "Primeira entrega", achieved: lifetimeCount >= 1 },
      { id: "c100", label: "100 entregas", achieved: lifetimeCount >= 100 },
      { id: "c500", label: "500 entregas", achieved: lifetimeCount >= 500 },
      { id: "c1000", label: "1.000 entregas", achieved: lifetimeCount >= 1000 },
      { id: "streak7", label: "7 dias seguidos", achieved: streak >= 7 },
      { id: "streak30", label: "30 dias seguidos", achieved: streak >= 30 },
      { id: "goal", label: "Meta batida hoje", achieved: today.length >= defaultGoal },
    ];

    const bestDay = pickMax(byDay);
    const bestWeek = pickMax(byWeek);
    const bestMonth = pickMax(byMonth);

    const avg = (n: number, d: number) => (d > 0 ? n / d : 0);

    return {
      driver,
      queue: {
        position: myPosition,
        length: queueLength,
        inQueue: !!myEntry,
        waitingSince,
        status: queueStatus,
      },
      active: active ? { assignment: active, order: activeOrder } : null,
      earnings: {
        today: sumEarn(today),
        yesterday: sumEarn(yesterday),
        week: sumEarn(week),
        month: sumEarn(month),
        year: sumEarn(year),
        todayCount: today.length,
        yesterdayCount: yesterday.length,
        weekCount: week.length,
        monthCount: month.length,
        yearCount: year.length,
        ticketToday: avg(sumEarn(today), today.length),
        ticketMonth: avg(sumEarn(month), month.length),
        dailyGoal: defaultGoal,
        bestDay,
        bestWeek,
        bestMonth,
      },
      stats: {
        avgAssignToDelivered: avgMinutes(year, "assigned_at", "delivered_at"),
        avgPickupToDelivered: avgMinutes(year, "picked_up_at", "delivered_at"),
        avgDepartToDelivered: avgMinutes(year, "departed_at", "delivered_at"),
        distanceToday: sumKm(today),
        distanceWeek: sumKm(week),
        distanceMonth: sumKm(month),
        streak,
      },
      history: (history ?? []).map((h) => ({
        ...h,
        earnings: h.status === "ENTREGUE" ? earn(h as Row) : 0,
        order: h.order_id ? orderMap.get(h.order_id) ?? null : null,
      })),
      ranking: {
        position: myRank,
        total: ranking.length,
        list: ranking.slice(0, 10),
      },
      achievements,
    };
  });

export const enterQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: driver } = await context.supabase
      .from("delivery_drivers")
      .select("id, restaurant_id, status")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!driver) throw new Error("Motoboy não encontrado");
    if (driver.status !== "ativo") throw new Error("Cadastro não está ativo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("queue_enqueue", {
      _restaurant_id: driver.restaurant_id, _driver_id: driver.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: driver } = await context.supabase
      .from("delivery_drivers")
      .select("id, restaurant_id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!driver) throw new Error("Motoboy não encontrado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("queue_remove", {
      _restaurant_id: driver.restaurant_id, _driver_id: driver.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const _driverDashboardSchema = z.object({});
